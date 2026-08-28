import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { BreadthPoint } from "../../src/types/history";

/**
 * Daily breadth recorder — the only writer in this codebase.
 *
 * WHY THIS EXISTS. Every other signal in the Fear and Optimism Index
 * is ranked against history PSX already publishes. Breadth is not:
 * PSX serves today's advancers, decliners and volumes and keeps no
 * archive of them, so the only way this signal can ever be ranked the
 * way the others are is to start writing the readings down. One row
 * per trading day, which means Breadth graduates in about two years.
 *
 * That is a long wait, and it is the honest one. The alternative was
 * to keep scoring Breadth through a fixed formula, which produced a
 * number that looked like the others' percentiles but did not mean the
 * same thing.
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

    if (!watch.breadth) {
      // Nothing to record is not a failure — it is a session the feed
      // could not describe, and inventing a row for it would be worse
      // than leaving a gap.
      res.status(200).json({ recorded: false, reason: "no breadth in payload" });
      return;
    }

    const trin = computeTrin(watch.breadth);
    if (trin === null) {
      res.status(200).json({ recorded: false, reason: "session has no TRIN" });
      return;
    }

    /*
     * Dated by the SESSION the payload describes, not by when this ran.
     * A cron that fires late, retries, or slips across midnight UTC
     * must not file the same session under two dates.
     */
    const date = (watch.asOf ?? new Date().toISOString()).slice(0, 10);

    const existingRaw = (await kv(`/get/${HISTORY_KEY}`)).result;
    const existing: BreadthPoint[] = existingRaw
      ? (JSON.parse(existingRaw) as BreadthPoint[])
      : [];

    // Idempotent: re-running for a session already recorded replaces
    // that row rather than appending a second one, so a manual trigger
    // or a Vercel retry cannot double-count a day.
    const next = existing.filter((p) => p.date !== date);
    next.push({ date, trin });
    next.sort((a, b) => (a.date < b.date ? -1 : 1));
    const trimmed = next.slice(-MAX_POINTS);

    await kv(`/set/${HISTORY_KEY}`, {
      method: "POST",
      body: JSON.stringify(trimmed),
      headers: { "Content-Type": "application/json" },
    });

    res.status(200).json({
      recorded: true,
      date,
      trin: Math.round(trin * 10_000) / 10_000,
      sessions: trimmed.length,
    });
  } catch (cause) {
    Sentry.captureException(cause);
    res.status(500).json({ error: "Could not record today's breadth" });
  }
}
