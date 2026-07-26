import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  GlobalFuturesQuote,
  GlobalFuturesResponse,
} from "../../src/types/global-futures";

/**
 * GET /api/market/global-futures
 *
 * Live global index-FUTURES quotes from PMEX (Pakistan Mercantile
 * Exchange) — one of AZEE's own two member exchanges. These are PMEX
 * futures contracts referencing the S&P 500, Nasdaq-100, Dow Jones, and
 * a Japan equity index — NOT spot index levels. The response is typed
 * and named as futures throughout so nothing downstream can present them
 * as index values (see src/types/global-futures.ts).
 *
 * Source: POST https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject
 * (empty body, no auth/cookies) returns all 155 PMEX contracts in one
 * call; we keep Category === "Indices". Reachable from both Vercel Node
 * and Edge (probed live); built on Node to match the other market-data
 * endpoints (snapshot/watch/indices-full) — the type-only import above
 * is erased at compile time and carries no runtime relative import.
 *
 * RUNTIME: Node.
 */

const PMEX_URL = "https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject";

/*
 * The benchmark families, keyed by the STANDARD-size contract's base
 * symbol (the part before the "-<expiry>"). PMEX also lists mini/micro
 * (MINISP500, MICROSP500) and multiple (2NSDQ100, JPYEQTY5) variants
 * whose price/change are IDENTICAL to the standard contract — they
 * differ only in contract size/volume — so showing one row per
 * benchmark (the standard contract) is the clean, non-redundant set.
 * "Standard" is read from the real symbol naming (no MINI/MICRO/multiple
 * prefix), not a fabricated "primary" flag. Base-symbol matching is
 * expiry-agnostic, so it survives contract rollover (SE26 → the next).
 */
const BENCHMARKS: { base: string; name: string }[] = [
  { base: "SP500", name: "S&P 500" },
  { base: "NSDQ100", name: "Nasdaq-100" },
  { base: "DJ", name: "Dow Jones" },
  { base: "JPYEQTY1", name: "Japan Equity" },
];

interface PmexContract {
  Contract: string;
  Bid: number | string;
  Ask: number | string;
  Open: number | string;
  Close: number | string;
  High: number | string;
  Low: number | string;
  Change: number | string;
  Change_Per: number | string;
  Total_Vol: number | string | null;
  Category: string;
  _datetime: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** High/Low are 0 when PMEX has not reported them (session closed); map
 *  that to null rather than a fabricated 0. */
function nullableLevel(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchGlobalFutures(): Promise<GlobalFuturesResponse> {
  const response = await fetch(PMEX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "azee-trade-web/1.0 (global futures)",
    },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`PMEX responded ${response.status} for market watch`);
  }
  const all = (await response.json()) as PmexContract[];
  if (!Array.isArray(all)) {
    throw new Error("PMEX returned a non-array payload");
  }
  const indices = all.filter((c) => c.Category === "Indices");
  // Structure sanity: the Indices category should carry its usual set of
  // contracts. A near-empty result means the feed/shape changed.
  if (indices.length < 6) {
    throw new Error(
      `PMEX Indices category has only ${indices.length} contracts — feed may have changed`,
    );
  }

  let freshest = 0;
  const futures: GlobalFuturesQuote[] = [];
  for (const { base, name } of BENCHMARKS) {
    // The standard contract for this benchmark, across any expiry, that
    // is actually active (non-zero bid — skips expired contracts, which
    // PMEX zeroes out). If several expiries are live, take the most
    // traded (the front month).
    const matches = indices
      .filter((c) => c.Contract.split("-")[0] === base && num(c.Bid) > 0)
      .sort((a, b) => num(b.Total_Vol) - num(a.Total_Vol));
    const c = matches[0];
    if (!c) continue;

    const changePoints = num(c.Change);
    futures.push({
      contract: c.Contract,
      benchmark: name,
      bid: num(c.Bid),
      ask: num(c.Ask),
      open: num(c.Open),
      previousClose: num(c.Close),
      changePoints: round2(changePoints),
      changePercent: round2(num(c.Change_Per)),
      direction: changePoints >= 0 ? "up" : "down",
      volume: Math.round(num(c.Total_Vol)),
      high: nullableLevel(c.High),
      low: nullableLevel(c.Low),
    });
    if (typeof c._datetime === "number" && c._datetime > freshest) {
      freshest = c._datetime;
    }
  }

  // Sanity floor: every benchmark family must resolve, or fall through
  // to lastGood rather than serve a partial set.
  if (futures.length < BENCHMARKS.length) {
    const found = futures.map((f) => f.benchmark).join(", ");
    throw new Error(
      `PMEX yielded only ${futures.length}/${BENCHMARKS.length} benchmark futures (${found})`,
    );
  }

  return {
    futures,
    asOf: new Date((freshest || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    source: "pmex",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when PMEX is down. */
let lastGood: GlobalFuturesResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const data = await fetchGlobalFutures();
    lastGood = data;
    /*
     * Cache TTL is derived from the data's own freshness rather than a
     * hardcoded session calendar, because these PMEX contracts follow
     * international (US/Japan) index-futures hours, not the PKT session
     * the PSX endpoints use. During a live session PMEX ticks these
     * every few seconds, so a 60s edge window keeps values within a
     * minute of live while capping origin to ~1 fetch/min. When the
     * data is stale (session closed — e.g. the weekend snapshot, whose
     * _datetime is hours old), a 30-minute window makes polls near-free
     * edge hits.
     */
    const ageSec = Date.now() / 1000 - Date.parse(data.asOf) / 1000;
    const live = ageSec <= 5 * 60;
    res.setHeader(
      "Cache-Control",
      live
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("PMEX global futures fetch failed:", error);
    if (lastGood) {
      // Serve the last verified quotes, clearly labelled — never
      // fabricate market data.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PMEX global index futures data is temporarily unavailable",
    });
  }
}
