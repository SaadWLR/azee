import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { StockQuote } from "../../src/types";
import type {
  BreadthPoint,
  GoldPoint,
  PriceStrengthPoint,
} from "../../src/types/history";

/**
 * Daily recorder — the only writer in this codebase.
 *
 * It records TWO histories, both for signals that need a past nobody
 * else is keeping for us.
 *
 * BREADTH. PSX serves today's advancers, decliners and volumes and
 * keeps no archive of them, so the only way that signal can ever be
 * ranked like the others is to start writing the readings down. One
 * row per trading day, which means Breadth graduates in about two
 * years. That is a long wait, and it is the honest one — the
 * alternative was to keep scoring it through a fixed formula, which
 * produced a number that looked like the others' percentiles but did
 * not mean the same thing.
 *
 * GOLD AND USD/PKR, for Safe Haven Demand. Same problem, much better
 * luck: the currency CDN behind /forex's gold estimate publishes DATED
 * snapshots as well as today's, so this history can be backfilled
 * rather than waited for. The backfill is bounded by a time budget and
 * skips whatever it already holds, so it resumes across scheduled runs
 * instead of having to finish in one — see recordGold below.
 *
 * ADAPTER IS INLINED. Vercel bundles each function in `api/`
 * separately, so runtime imports between them do not resolve — this
 * calls the deployed watch endpoint over HTTP rather than importing
 * its parser, and carries its own copy of the TRIN arithmetic. The
 * type import is import-type only and vanishes at build.
 *
 * WRITE PATH IS THE KV REST API, over plain fetch. `@vercel/kv` would
 * be a dependency for one GET and one SET against an interface that is
 * already just an authenticated HTTP call.
 */

/*
 * SCHEDULE: "0 11 * * 1-5" in vercel.json — 11:00 UTC is 16:00 PKT,
 * half an hour after the PSX close, Mon-Fri because the exchange does
 * not trade at weekends. Hobby allows one cron at daily-or-slower
 * frequency, which this is.
 *
 * That reasoning lives here rather than beside the entry because
 * vercel.json is validated against a strict schema: an explanatory
 * "comment" key inside a crons entry is not an unknown-but-ignored
 * property, it fails the deployment outright. Learned the hard way —
 * the first attempt at this shipped one and the whole deploy was
 * rejected while the previous build kept serving.
 */
const HISTORY_KEY = "breadth:trin:history";
const GOLD_KEY = "gold:history";

/**
 * PSX's end-of-day archive. The KSE-100 series is the trading calendar
 * gold is priced against; the same base serves any single symbol, which
 * is where Price Strength's year-ago reference prices come from.
 */
const EOD_BASE = "https://dps.psx.com.pk/timeseries/eod";
const EOD_URL = `${EOD_BASE}/KSE100`;
const CDN = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";

/**
 * The currency CDN's dated archive begins around here. Probed by
 * bisection: 2024-03-02 resolves, 2024-03-01 and everything before it
 * 404s. Asking for earlier dates only buys a wall of misses.
 */
const GOLD_EPOCH = "2024-03-02";

/**
 * Backfill pacing.
 *
 * Measured against the real workload: 614 PSX sessions at 30
 * concurrent fetches ran 70ms per date, so a complete backfill is
 * about 43 seconds. Hobby caps a function at 60, which leaves no room
 * to also do the breadth work and the KV writes — so the fetch loop
 * runs to a DEADLINE rather than to completion, writes what it has,
 * and picks up the rest on the next scheduled run. The idempotent
 * skip below is what makes that safe.
 */
const GOLD_BATCH = 30;
const GOLD_BUDGET_MS = 32_000;

const PRICE_STRENGTH_REFS_KEY = "price-strength:references";
const PRICE_STRENGTH_HISTORY_KEY = "price-strength:breadth:history";

/**
 * How many symbols' year-old reference prices get refreshed per run,
 * and how long that's allowed to take.
 *
 * NOT a one-time backfill like Gold's. Gold fills a fixed historical
 * record that never changes once written; "a year ago" is a MOVING
 * target, a different date tomorrow than today, so this rotates
 * through the symbol list forever, refreshing whichever references
 * are stalest. At ~490 symbols and 8 concurrent fetches per batch
 * within a 12s budget, a full rotation takes roughly a month, which
 * keeps "about a year ago" honest without this becoming the dominant
 * cost of the function.
 *
 * This is deliberately the lowest-priority fetch here: it runs last,
 * after Breadth, today's price-strength ratio and Gold's backfill have
 * all had their turn, so a slow day costs rotation progress and never
 * a recorded reading.
 */
const PRICE_STRENGTH_REFRESH_BUDGET_MS = 12_000;
const PRICE_STRENGTH_REFRESH_CONCURRENCY = 8;

/** ~365 days, and how far from that mark a session may sit and still count as "about a year ago." */
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const YEAR_TOLERANCE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Roughly four years of trading days.
 *
 * The index ranks against the trailing ~500 sessions, so anything past
 * that is dead weight in every read — but the surplus is kept rather
 * than trimmed to exactly 500, because a longer record is worth having
 * once someone wants to look further back than the gauge does, and a
 * thousand small rows is a trivial value to store.
 */
const MAX_POINTS = 1000;

interface WatchBreadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  advancingVolume: number;
  decliningVolume: number;
}

/**
 * One session's Arms Index (TRIN), or null when the session cannot
 * produce one.
 *
 * Deliberately identical to computeTrin in sentimentService — same
 * guards, same one-sided sentinels, same refusal to turn an absence of
 * data into a neutral reading. It is duplicated rather than imported
 * because of the bundling rule above, and the pair is covered by a
 * test that asserts they agree, so the copy cannot drift silently.
 */
function computeTrin(b: WatchBreadth): number | null {
  const { advancers, decliners, advancingVolume, decliningVolume } = b;
  if (advancers + decliners === 0) return null;
  if (advancingVolume + decliningVolume === 0) return null;
  if (decliners === 0 || decliningVolume === 0) return 0.01;
  if (advancers === 0 || advancingVolume === 0) return 100;
  return advancers / decliners / (advancingVolume / decliningVolume);
}

/**
 * The site's own origin, so the cron can call its own endpoint.
 *
 * THE PRODUCTION ALIAS, NOT THE REQUEST'S OWN HOST, and that
 * distinction is what makes this function work at all.
 *
 * Vercel schedules a cron against the DEPLOYMENT-specific hostname
 * (azee-<hash>-<team>.vercel.app), not the project's alias. This
 * project has Vercel Authentication enabled with deploymentType
 * "all_except_custom_domains", so that hostname sits behind SSO.
 * Vercel's own invocation of the cron is trusted and gets through,
 * but a fetch made BY this function is a fresh unauthenticated
 * request: it is redirected to vercel.com/login, follows the redirect
 * (fetch does by default), and comes back 200 with an HTML sign-in
 * page. `response.ok` is therefore true, the guard below passes, and
 * `.json()` throws on the HTML — which the outer catch turned into a
 * 500 every scheduled run for a week, writing nothing.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the project's production domain,
 * which is exempt from that protection. Falling back to the request
 * host keeps the previous behaviour anywhere the variable is absent,
 * so this is strictly an improvement rather than a swap.
 */
function selfOrigin(req: VercelRequest): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
}

async function kv(
  path: string,
  init?: RequestInit,
): Promise<{ result?: string | null }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV is not configured");
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`KV responded ${response.status}`);
  return (await response.json()) as { result?: string | null };
}

/**
 * The PSX trading calendar, from the exchange's own EOD archive.
 *
 * Gold is priced only on dates the KSE-100 actually closed. Weekends
 * and holidays have no index close to compare a gold return against,
 * so fetching them would buy rows the signal can never align and spend
 * the backfill budget doing it.
 *
 * Inlined rather than imported from api/market/history.ts for the
 * bundling reason above.
 */
async function fetchSessionDates(): Promise<string[]> {
  const response = await fetch(EOD_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PSX EOD responded ${response.status}`);
  const body = (await response.json()) as { data?: [number, ...number[]][] };
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows
    .map((r) => new Date(r[0] * 1000).toISOString().slice(0, 10))
    .filter((d) => d >= GOLD_EPOCH)
    .sort();
}

/**
 * One date's gold and USD/PKR, or null if it cannot be trusted.
 *
 * Null covers a 404 on a date the CDN never published, a shape change,
 * and a value outside what either instrument has plausibly traded at.
 * The caller skips nulls and keeps going: one bad date must degrade to
 * a missing row, never take down a backfill of six hundred.
 *
 * The bounds are the same sanity floor fetchGoldEstimate uses in
 * api/market/forex.ts — gold has not traded below $500/oz this
 * century, and a wild number means the feed changed rather than the
 * market.
 */
async function fetchGoldOn(date: string): Promise<GoldPoint | null> {
  try {
    const [xau, usd] = await Promise.all([
      fetch(`${CDN}@${date}/v1/currencies/xau.json`, {
        signal: AbortSignal.timeout(12_000),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${CDN}@${date}/v1/currencies/usd.json`, {
        signal: AbortSignal.timeout(12_000),
      }).then((r) => (r.ok ? r.json() : null)),
    ]);
    const xauUsd = (xau as { xau?: Record<string, number> } | null)?.xau?.usd;
    const usdPkr = (usd as { usd?: Record<string, number> } | null)?.usd?.pkr;
    if (!Number.isFinite(xauUsd) || !Number.isFinite(usdPkr)) return null;
    if (xauUsd! < 500 || xauUsd! > 20_000) return null;
    if (usdPkr! < 50 || usdPkr! > 1_000) return null;
    return { date, xauUsd: xauUsd!, usdPkr: usdPkr! };
  } catch {
    return null;
  }
}

/**
 * Record gold for every PSX session not already held, within a time
 * budget.
 *
 * RESUMABLE BY CONSTRUCTION. Dates already in the store are filtered
 * out before anything is fetched, so the first run does the bulk of
 * the ~614-session backfill, a run that stops at the deadline resumes
 * exactly where it left off the next day, and every run after that
 * fetches only the one new session. There is no "have I backfilled
 * yet" flag to get out of step with the data.
 *
 * The deadline is checked between batches rather than mid-flight, so
 * the write always happens with a full batch's results in hand.
 */
async function recordGold(): Promise<{
  added: number;
  skipped: number;
  sessions: number;
  complete: boolean;
}> {
  const existingRaw = (await kv(`/get/${GOLD_KEY}`)).result;
  const existing: GoldPoint[] = existingRaw
    ? (JSON.parse(existingRaw) as GoldPoint[])
    : [];
  const held = new Set(existing.map((p) => p.date));

  const wanted = (await fetchSessionDates()).filter((d) => !held.has(d));
  if (!wanted.length) {
    return { added: 0, skipped: 0, sessions: existing.length, complete: true };
  }

  // Newest first: if the budget runs out, the dates the signal needs
  // most — the recent end it ranks today against — are already in.
  wanted.reverse();

  const deadline = Date.now() + GOLD_BUDGET_MS;
  const collected: GoldPoint[] = [];
  let attempted = 0;
  let index = 0;
  while (index < wanted.length && Date.now() < deadline) {
    const batch = wanted.slice(index, index + GOLD_BATCH);
    index += batch.length;
    attempted += batch.length;
    const results = await Promise.all(batch.map(fetchGoldOn));
    for (const point of results) if (point) collected.push(point);
  }

  const byDate = new Map(existing.map((p) => [p.date, p]));
  for (const point of collected) byDate.set(point.date, point);
  const merged = [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-MAX_POINTS);

  await kv(`/set/${GOLD_KEY}`, {
    method: "POST",
    body: JSON.stringify(merged),
    headers: { "Content-Type": "application/json" },
  });

  return {
    added: collected.length,
    skipped: attempted - collected.length,
    sessions: merged.length,
    complete: index >= wanted.length,
  };
}

/* ── Price Strength ─────────────────────────────────────────────── */

interface PriceReference {
  referencePrice: number;
  referenceDate: string;
  /** The date this reference was last (re)fetched — drives rotation priority. */
  seededAt: string;
}

/**
 * One symbol's close from roughly a year ago, or null if PSX's archive
 * doesn't reach that far back for it (a newly-listed company) or
 * nothing sits within YEAR_TOLERANCE_MS of the mark.
 *
 * Deliberately lighter than parseEod in api/market/history.ts: this
 * needs exactly one row, not the whole series, so building the full
 * EodPoint array just to keep one value from it isn't worth doing here.
 * Same upstream (EOD_BASE + symbol), same envelope shape.
 */
async function fetchYearAgoClose(
  symbol: string,
): Promise<{ price: number; date: string } | null> {
  try {
    const response = await fetch(`${EOD_BASE}/${symbol}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: [number, number, number, number][];
    };
    const rows = Array.isArray(body?.data) ? body.data : [];
    const targetMs = Date.now() - YEAR_MS;

    let best: { price: number; date: string } | null = null;
    let bestGapMs = Infinity;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const [epoch, close] = row;
      if (!Number.isFinite(epoch) || !Number.isFinite(close) || close <= 0) continue;
      const gapMs = Math.abs(epoch * 1000 - targetMs);
      if (gapMs < bestGapMs) {
        bestGapMs = gapMs;
        best = {
          price: close,
          date: new Date(epoch * 1000).toISOString().slice(0, 10),
        };
      }
    }
    return best && bestGapMs <= YEAR_TOLERANCE_MS ? best : null;
  } catch {
    return null;
  }
}

/** Reads the stored reference-price map, or an empty one if none exists yet. */
async function readPriceStrengthReferences(): Promise<Map<string, PriceReference>> {
  const raw = (await kv(`/get/${PRICE_STRENGTH_REFS_KEY}`)).result;
  if (!raw) return new Map();
  const parsed = JSON.parse(raw) as Record<string, PriceReference>;
  return new Map(Object.entries(parsed));
}

async function writePriceStrengthReferences(
  refs: Map<string, PriceReference>,
): Promise<void> {
  await kv(`/set/${PRICE_STRENGTH_REFS_KEY}`, {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(refs)),
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Refresh whichever symbols' references are stalest, within budget.
 *
 * ROTATES FOREVER rather than running once to completion — see the
 * const doc above for why. Never-seeded symbols (new listings, or the
 * very first runs of all) sort first by construction: a missing
 * `seededAt` is treated as the oldest possible value.
 *
 * Mutates `refs` in place and returns how many genuinely improved; the
 * caller owns writing the result to KV once, after both this and the
 * day's ratio have finished using it.
 */
async function refreshPriceStrengthReferences(
  refs: Map<string, PriceReference>,
  currentSymbols: string[],
): Promise<{ refreshed: number }> {
  // Prune delisted symbols so the store does not grow unbounded.
  const live = new Set(currentSymbols);
  for (const symbol of [...refs.keys()]) {
    if (!live.has(symbol)) refs.delete(symbol);
  }

  const queue = [...currentSymbols].sort((a, b) => {
    const aSeeded = refs.get(a)?.seededAt ?? "";
    const bSeeded = refs.get(b)?.seededAt ?? "";
    return aSeeded < bSeeded ? -1 : aSeeded > bSeeded ? 1 : 0;
  });

  const today = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + PRICE_STRENGTH_REFRESH_BUDGET_MS;
  let refreshed = 0;
  let index = 0;
  while (index < queue.length && Date.now() < deadline) {
    const batch = queue.slice(index, index + PRICE_STRENGTH_REFRESH_CONCURRENCY);
    index += batch.length;
    const results = await Promise.all(
      batch.map((symbol) => fetchYearAgoClose(symbol)),
    );
    batch.forEach((symbol, i) => {
      const found = results[i];
      /*
       * Even a miss updates seededAt: an unlistable symbol (too young
       * for a year-old close yet) must not monopolize every day's
       * budget by staying "oldest" forever. It rotates back in with
       * everything else and is retried automatically once it has a
       * real chance of succeeding.
       */
      refs.set(symbol, {
        referencePrice: found?.price ?? refs.get(symbol)?.referencePrice ?? 0,
        referenceDate: found?.date ?? refs.get(symbol)?.referenceDate ?? "",
        seededAt: today,
      });
      if (found) refreshed++;
    });
  }
  return { refreshed };
}

/**
 * Today's price-strength share: stocks trading above their reference
 * minus stocks trading below, over however many could be compared. A
 * symbol with no reference yet (still being rotated in) or a
 * non-positive live price is simply not counted — never treated as
 * "unchanged," which would quietly pull the ratio toward zero.
 */
function computePriceStrengthShare(
  quotes: StockQuote[],
  refs: Map<string, PriceReference>,
): number | null {
  let above = 0;
  let below = 0;
  let compared = 0;
  for (const quote of quotes) {
    const ref = refs.get(quote.symbol);
    if (!ref || !(ref.referencePrice > 0) || !(quote.price > 0)) continue;
    compared++;
    if (quote.price > ref.referencePrice) above++;
    else if (quote.price < ref.referencePrice) below++;
  }
  if (compared === 0) return null;
  return (above - below) / compared;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  /*
   * Vercel signs its own cron invocations. Without this the route is a
   * public write endpoint that anyone could drive, and a caller firing
   * it repeatedly could stuff a day's history with duplicate readings.
   * CRON_SECRET is set automatically for deployments with a cron
   * configured; when it is absent the route refuses rather than
   * defaulting open.
   */
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Recorder is not configured" });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const watchResponse = await fetch(
      `${selfOrigin(req)}/api/market/watch`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!watchResponse.ok) {
      throw new Error(`Market watch responded ${watchResponse.status}`);
    }
    const watch = (await watchResponse.json()) as {
      breadth?: WatchBreadth;
      quotes?: StockQuote[];
      asOf?: string;
    };

    /*
     * Dated by the SESSION the payload describes, not by when this
     * ran. A cron that fires late, retries, or slips across midnight
     * UTC must not file the same session under two dates.
     *
     * Hoisted here because more than one recorded history is filed
     * under it now, and two readings from one payload landing on
     * different dates would be worse than either being late.
     */
    const date = (watch.asOf ?? new Date().toISOString()).slice(0, 10);

    /*
     * BREADTH FIRST, and on its own. This was the function's original
     * and only job; gold is the addition. Breadth is recorded and
     * committed before the gold backfill is even started, so a CDN
     * outage or a budget overrun on the new work cannot cost the day's
     * breadth reading — the one thing here that genuinely cannot be
     * recovered later.
     */
    let breadth: { recorded: boolean; date?: string; trin?: number; sessions?: number; reason?: string };

    if (!watch.breadth) {
      // Nothing to record is not a failure — it is a session the feed
      // could not describe, and inventing a row for it would be worse
      // than leaving a gap.
      breadth = { recorded: false, reason: "no breadth in payload" };
    } else {
      const trin = computeTrin(watch.breadth);
      if (trin === null) {
        breadth = { recorded: false, reason: "session has no TRIN" };
      } else {
        const existingRaw = (await kv(`/get/${HISTORY_KEY}`)).result;
        const existing: BreadthPoint[] = existingRaw
          ? (JSON.parse(existingRaw) as BreadthPoint[])
          : [];

        // Idempotent: re-running for a session already recorded
        // replaces that row rather than appending a second one, so a
        // manual trigger or a Vercel retry cannot double-count a day.
        const next = existing.filter((p) => p.date !== date);
        next.push({ date, trin });
        next.sort((a, b) => (a.date < b.date ? -1 : 1));
        const trimmed = next.slice(-MAX_POINTS);

        await kv(`/set/${HISTORY_KEY}`, {
          method: "POST",
          body: JSON.stringify(trimmed),
          headers: { "Content-Type": "application/json" },
        });

        breadth = {
          recorded: true,
          date,
          trin: Math.round(trin * 10_000) / 10_000,
          sessions: trimmed.length,
        };
      }
    }

    /*
     * Price strength's RATIO for today — cheap, no fetch of its own
     * (reuses watch.quotes, already in hand), and dated exactly like
     * breadth: a day's ratio cannot be reconstructed after the fact,
     * so this runs before Gold's time-budgeted backfill and before the
     * reference rotation below, not after either.
     */
    const priceStrengthRefs = await readPriceStrengthReferences();
    let priceStrength: { recorded: boolean; date?: string; share?: number; sessions?: number; reason?: string };
    try {
      const quotes = Array.isArray(watch.quotes) ? watch.quotes : [];
      const share = computePriceStrengthShare(quotes, priceStrengthRefs);
      if (share === null) {
        priceStrength = {
          recorded: false,
          reason: "no symbols could be compared to a reference yet",
        };
      } else {
        const existingRaw = (await kv(`/get/${PRICE_STRENGTH_HISTORY_KEY}`)).result;
        const existing: PriceStrengthPoint[] = existingRaw
          ? (JSON.parse(existingRaw) as PriceStrengthPoint[])
          : [];
        const next = existing.filter((p) => p.date !== date);
        next.push({ date, share: Math.round(share * 10_000) / 10_000 });
        next.sort((a, b) => (a.date < b.date ? -1 : 1));
        const trimmed = next.slice(-MAX_POINTS);
        await kv(`/set/${PRICE_STRENGTH_HISTORY_KEY}`, {
          method: "POST",
          body: JSON.stringify(trimmed),
          headers: { "Content-Type": "application/json" },
        });
        priceStrength = {
          recorded: true,
          date,
          share: Math.round(share * 10_000) / 10_000,
          sessions: trimmed.length,
        };
      }
    } catch (cause) {
      Sentry.captureException(cause);
      priceStrength = {
        recorded: false,
        reason: "price strength ratio could not be recorded",
      };
    }

    /*
     * Then gold, in its own try. A failure here is reported and
     * surfaced in the response, but it returns 200: breadth is already
     * written, and answering 500 would make a successful run look
     * failed to anyone reading cron logs.
     */
    let gold: Record<string, unknown>;
    try {
      gold = await recordGold();
    } catch (cause) {
      Sentry.captureException(cause);
      gold = { error: "gold history could not be recorded this run" };
    }

    /*
     * Finally, rotate a slice of the reference prices — least
     * time-sensitive of everything here, so it runs last and simply
     * makes less progress on a day the deadline arrives early. Reuses
     * the SAME watch.quotes-derived symbol list and the SAME `refs`
     * map already read above; nothing else writes this key within one
     * invocation, so re-reading it here would only cost time for no
     * benefit. Isolated in its own try for the same reason gold is: a
     * failure here must not cost today's already-recorded ratio.
     */
    let priceStrengthRefresh: { refreshed: number; symbols: number } | { error: string };
    try {
      const quotes = Array.isArray(watch.quotes) ? watch.quotes : [];
      const symbols = quotes.map((q) => q.symbol);
      const { refreshed } = await refreshPriceStrengthReferences(
        priceStrengthRefs,
        symbols,
      );
      await writePriceStrengthReferences(priceStrengthRefs);
      priceStrengthRefresh = { refreshed, symbols: priceStrengthRefs.size };
    } catch (cause) {
      Sentry.captureException(cause);
      priceStrengthRefresh = { error: "reference refresh failed" };
    }

    res.status(200).json({ breadth, priceStrength, gold, priceStrengthRefresh });
  } catch (cause) {
    Sentry.captureException(cause);
    res.status(500).json({ error: "Could not record today's breadth" });
  }
}
