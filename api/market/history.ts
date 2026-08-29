import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  BreadthPoint,
  EodPoint,
  GoldPoint,
  KseHistoryResponse,
} from "../../src/types/history";

/**
 * GET /api/market/history
 *
 * The KSE-100's end-of-day archive, plus the two histories the daily
 * recorder keeps: market breadth, and gold/USD-PKR for Safe Haven
 * Demand.
 *
 * WHY THEY TRAVEL TOGETHER. They are unrelated in origin — one is
 * PSX's own multi-year archive, the others are files this site writes
 * because nobody publishes them for us. They share an endpoint for one
 * reason: the Hobby plan allows twelve serverless functions and this
 * project sits at eleven, so a separate route per history would be a
 * poor way to spend the last one. All three are "history the sentiment
 * index ranks against", all are fetched once per page load, and none
 * changes more than daily.
 *
 * ADAPTER IS INLINED. Vercel builds each function in `api/` as its own
 * bundle, so runtime imports BETWEEN them do not resolve — the same
 * reason indices-full.ts and psx-watch.ts each carry their own parser.
 * Types are import-type only and vanish at build.
 *
 * CACHED HARD. The upstream publishes once a day after close, so the
 * 60s window the live-market routes use would buy nothing but load on
 * PSX. This follows forex.ts's once-daily reasoning instead.
 */

const EOD_URL = "https://dps.psx.com.pk/timeseries/eod/KSE100";

/** Sanity floor: PSX's archive runs to thousands of sessions. */
const MIN_VALID_POINTS = 200;

/**
 * PSX's row shape: [epochSeconds, close, volume, <index level>].
 *
 * The fourth column is NOT traded value despite the obvious reading of
 * the name — measured over the whole series it correlates 0.9998 with
 * the close and spans the close's own range. See EodPoint.indexAverage
 * for the full finding. It is mapped through under a name that says so.
 */
type PsxEodRow = [number, number, number, number];

interface PsxEodEnvelope {
  status?: number;
  message?: string;
  data?: unknown;
}

function toIsoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

function parseEod(payload: unknown): EodPoint[] {
  const envelope = payload as PsxEodEnvelope;
  const rows = Array.isArray(envelope?.data) ? envelope.data : null;
  if (!rows) {
    throw new Error(
      "PSX EOD payload had no data array — response shape may have changed",
    );
  }

  const points: EodPoint[] = [];
  for (const row of rows as PsxEodRow[]) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [epoch, close, volume, indexAverage] = row;
    /*
     * Every field must be a real finite number. A row that fails is
     * skipped rather than defaulted to zero: a zero close would poison
     * a return series and a zero volume would drag a volume average,
     * and both would do it silently.
     */
    if (
      !Number.isFinite(epoch) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume) ||
      !Number.isFinite(indexAverage) ||
      close <= 0
    ) {
      continue;
    }
    points.push({
      date: toIsoDate(epoch),
      close,
      volume,
      indexAverage,
    });
  }

  // PSX serves newest-first; every consumer here walks forward in
  // time, so it is reversed once at the boundary rather than in each
  // of them.
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (points.length < MIN_VALID_POINTS) {
    throw new Error(
      `PSX EOD parse yielded only ${points.length} valid sessions — source may have changed`,
    );
  }
  return points;
}

async function fetchEod(): Promise<EodPoint[]> {
  const response = await fetch(EOD_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`PSX EOD responded ${response.status}`);
  }
  return parseEod(await response.json());
}

/**
 * The recorded breadth series, read straight off the KV REST API.
 *
 * No client library. `@vercel/kv` would be a dependency to pull one
 * GET, and the store's REST interface is a plain authenticated fetch —
 * the same reasoning that kept an HTML parser out of the announcements
 * adapter.
 *
 * ABSENT IS NOT EMPTY, AND NEITHER IS AN ERROR. Until the store is
 * provisioned the env vars simply are not there, and that is the
 * expected state rather than a fault: this returns undefined, the
 * response omits the field, and Breadth stays calibrating for the
 * reason it is already calibrating. A store that exists but fails is
 * reported to Sentry and then treated the same way, because a history
 * we could not read is not a history of zero readings.
 */
async function readKvHistory<T extends { date: string }>(
  key: string,
  valid: (row: T) => boolean,
): Promise<T[] | undefined> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;

  try {
    const response = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`KV responded ${response.status}`);
    const body = (await response.json()) as { result?: string | null };
    if (!body.result) return [];
    const parsed = JSON.parse(body.result) as T[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => typeof p?.date === "string" && valid(p))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch (cause) {
    Sentry.captureException(cause);
    return undefined;
  }
}

const fetchBreadthHistory = () =>
  readKvHistory<BreadthPoint>(
    "breadth:trin:history",
    (p) => Number.isFinite(p.trin) && p.trin > 0,
  );

/*
 * Same store, same reader, same absent-is-not-empty rule. The value
 * check mirrors the recorder's own sanity bounds, so a row that could
 * not have been written by this codebase is dropped on the way out
 * rather than reaching a signal.
 */
const fetchGoldHistory = () =>
  readKvHistory<GoldPoint>(
    "gold:history",
    (p) =>
      Number.isFinite(p.xauUsd) &&
      Number.isFinite(p.usdPkr) &&
      p.xauUsd > 500 &&
      p.usdPkr > 50,
  );

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: EodPoint[] | null = null;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // The breadth read never blocks the archive: they are independent
  // sources and one being unavailable must not cost the other.
  const breadthPromise = fetchBreadthHistory();
  const goldPromise = fetchGoldHistory();

  try {
    const points = await fetchEod();
    lastGood = points;
    /*
     * A full trading day of edge cache. The upstream updates once,
     * after close; anything shorter re-fetches 52 KB to be told the
     * same thing. stale-while-revalidate carries the previous day
     * across the gap between close and the next publish.
     */
    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400",
    );
    const body: KseHistoryResponse = {
      points,
      breadthHistory: await breadthPromise,
      goldHistory: await goldPromise,
      asOf: new Date().toISOString(),
      source: "psx",
    };
    res.status(200).json(body);
  } catch (cause) {
    Sentry.captureException(cause);
    if (lastGood) {
      res.setHeader("Cache-Control", "s-maxage=300");
      const body: KseHistoryResponse = {
        points: lastGood,
        breadthHistory: await breadthPromise,
        goldHistory: await goldPromise,
        asOf: new Date().toISOString(),
        source: "cache",
        stale: true,
      };
      res.status(200).json(body);
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "KSE-100 history is temporarily unavailable",
    });
  }
}
