import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { BreadthPoint, GoldPoint } from "../../src/types/history";

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

/** PSX's own trading calendar — the only dates worth pricing gold on. */
const EOD_URL = "https://dps.psx.com.pk/timeseries/eod/KSE100";
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

/** The site's own origin, so the cron can call its own endpoint. */
function selfOrigin(req: VercelRequest): string {
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
      asOf?: string;
    };

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
        /*
         * Dated by the SESSION the payload describes, not by when this
         * ran. A cron that fires late, retries, or slips across
         * midnight UTC must not file the same session under two dates.
         */
        const date = (watch.asOf ?? new Date().toISOString()).slice(0, 10);

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

    res.status(200).json({ breadth, gold });
  } catch (cause) {
    Sentry.captureException(cause);
    res.status(500).json({ error: "Could not record today's breadth" });
  }
}
