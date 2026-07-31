import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ForexRate, ForexResponse } from "../../src/types/forex";

/**
 * GET /api/market/forex
 *
 * Mid-market PKR cross rates for the major currencies AZEE's audience
 * cares about, from ExchangeRate-API's keyless open endpoint.
 *
 * WHAT THIS IS NOT: these are not Pakistani open-market (money changer)
 * rates and carry no bid/ask spread — the source publishes a single
 * mid-market reference rate per currency. See src/types/forex.ts.
 *
 * FRESHNESS, which is the whole point here: the source updates ONCE
 * DAILY and says so honestly through its own time_last_update_utc /
 * time_next_update_utc fields. Those are passed through verbatim so the
 * UI can show the source's real timestamp. We never substitute our own
 * request time — several candidate sources were rejected during
 * research precisely for advancing a clock while their numbers sat
 * still, and reproducing that here would be the same dishonesty.
 *
 * The adapter is inlined — no relative runtime imports between compiled
 * functions (see api/market/snapshot.ts for the
 * FUNCTION_INVOCATION_FAILED history). Type-only imports above are
 * erased at compile time and safe.
 *
 * RUNTIME: Node. Probed live from Vercel: open.er-api.com answers 200
 * from BOTH Node and Edge (unusually — every PSX-adjacent host on this
 * project is blocked on one side), so Node is chosen only to match the
 * other market endpoints, not out of necessity.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const FOREX_URL = "https://open.er-api.com/v6/latest/USD";

/**
 * Attribution is a condition of the keyless open endpoint's terms
 * ("Open API — No API Key — Attribution Required"). Carried in the
 * payload so the UI cannot render the rates without also having the
 * credit to hand.
 */
const ATTRIBUTION = "Rates by ExchangeRate-API";

/**
 * The eight currencies, in display order. Names are ours (the source
 * returns codes only) and are plain descriptive labels, not data.
 */
const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
];

/** Hard ceiling on the edge cache: never lag a source update by more
 *  than this, even though the source only moves once a day. */
const MAX_CACHE_SECONDS = 3600;

interface ErApiResponse {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  rates?: Record<string, number>;
}

/** PKR per unit of `code`, from a USD-based rate table. */
function crossRate(rates: Record<string, number>, code: string): number | null {
  const pkrPerUsd = rates.PKR;
  const unitPerUsd = code === "USD" ? 1 : rates[code];
  if (!Number.isFinite(pkrPerUsd) || pkrPerUsd <= 0) return null;
  if (!Number.isFinite(unitPerUsd) || unitPerUsd <= 0) return null;
  return pkrPerUsd / unitPerUsd;
}

/** JPY needs more precision than USD; 4dp reads correctly for both. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function fetchForex(): Promise<ForexResponse> {
  const response = await fetch(FOREX_URL, {
    headers: { "User-Agent": "azee-trade-web/1.0 (forex)" },
  });
  if (!response.ok) {
    throw new Error(`ExchangeRate-API responded ${response.status}`);
  }
  const body = (await response.json()) as ErApiResponse;

  /*
   * Shape checks before trusting anything. The source signals success
   * explicitly, and PKR is the denominator of every rate here — a
   * missing PKR must fail loudly rather than yield eight nulls.
   */
  if (body.result !== "success") {
    throw new Error(`ExchangeRate-API result was "${body.result}"`);
  }
  if (!body.rates || typeof body.rates !== "object") {
    throw new Error("ExchangeRate-API returned no rates object");
  }
  if (!Number.isFinite(body.rates.PKR)) {
    throw new Error("ExchangeRate-API response is missing the PKR rate");
  }
  if (!body.time_last_update_utc) {
    throw new Error(
      "ExchangeRate-API response carries no time_last_update_utc — refusing to serve rates without the source's own timestamp",
    );
  }

  const rates: ForexRate[] = [];
  for (const { code, name } of CURRENCIES) {
    const value = crossRate(body.rates, code);
    // A currency the source dropped is omitted, never zero-filled.
    if (value === null) continue;
    rates.push({ code, name, pkrPerUnit: round4(value) });
  }
  if (rates.length < CURRENCIES.length) {
    const got = rates.map((r) => r.code).join(", ");
    throw new Error(
      `ExchangeRate-API yielded only ${rates.length}/${CURRENCIES.length} currencies (${got})`,
    );
  }

  return {
    rates,
    sourceUpdatedAt: body.time_last_update_utc,
    sourceNextUpdateAt: body.time_next_update_utc ?? null,
    attribution: ATTRIBUTION,
    source: "er-api",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/**
 * Seconds the payload can be cached for: until just after the source
 * says it will next update, capped at an hour.
 *
 * Derived from the source's own schedule rather than a flat number —
 * the same freshness-derived approach as the PMEX endpoints. The cap
 * means we re-check at least hourly against a once-daily source, so a
 * published update is picked up well within the hour; the derivation
 * means that when an update is imminent we refresh promptly instead of
 * sitting on a stale hour-long window.
 */
function cacheSeconds(nextUpdate: string | null): number {
  if (!nextUpdate) return MAX_CACHE_SECONDS;
  const until = Date.parse(nextUpdate) - Date.now();
  if (!Number.isFinite(until) || until <= 0) return 60;
  return Math.min(MAX_CACHE_SECONDS, Math.max(60, Math.ceil(until / 1000) + 60));
}

/** Survives warm invocations; the graceful answer when the source is down. */
let lastGood: ForexResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const data = await fetchForex();
    lastGood = data;
    res.setHeader(
      "Cache-Control",
      `s-maxage=${cacheSeconds(data.sourceNextUpdateAt)}, stale-while-revalidate=86400`,
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("Forex fetch failed:", error);
    if (lastGood) {
      /*
       * Serve the last verified rates, flagged stale — and critically,
       * still carrying the SOURCE's original timestamp, so the UI keeps
       * showing when the data was actually published rather than
       * implying it is current.
       */
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Foreign exchange rates are temporarily unavailable",
    });
  }
}

export { fetchForex };
