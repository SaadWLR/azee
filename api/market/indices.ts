import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  MarketIndexQuote,
  MarketIndicesResponse,
  MarketStatus,
} from "../../src/types";

/**
 * GET /api/market/indices
 *
 * Live values for PSX's main benchmark indices, each normalized to the
 * same shape as the KSE-100 snapshot. The frontend never talks to PSX
 * directly (no CORS on the portal, and the raw payload stays
 * server-side). This is the multi-index sibling of /api/market/snapshot,
 * which is left untouched and remains the single-index KSE-100 source.
 *
 * The PSX adapter is inlined (no relative runtime imports) for the same
 * reason as snapshot.ts: extensionless ESM imports between compiled
 * files are a known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects. Type-only imports are erased at compile
 * time and safe.
 *
 * Data integrity: every value is a real PSX tick or close. An index
 * that fails to fetch is OMITTED from the response — never fabricated,
 * never zero-filled. If every index fails (PSX unreachable) the handler
 * falls through to lastGood/503, matching snapshot.ts and watch.ts.
 */

/*
 * The benchmark indices, in display order. Codes verified live against
 * dps.psx.com.pk/timeseries (int + eod both return real series):
 *   KSE100     KSE-100         KSE30      KSE-30
 *   ALLSHR     KSE All Share   KMI30      KMI-30
 *   KMIALLSHR  KMI All Share
 * (KSEALL / KMIALL / sector codes like BKTi return empty and are not
 * used.) Adding a future confirmed index is a one-line entry here.
 */
const INDICES: { code: string; name: string }[] = [
  { code: "KSE100", name: "KSE-100" },
  { code: "KSE30", name: "KSE-30" },
  { code: "ALLSHR", name: "KSE All Share" },
  { code: "KMI30", name: "KMI-30" },
  { code: "KMIALLSHR", name: "KMI All Share" },
];

const INTRADAY_BASE = "https://dps.psx.com.pk/timeseries/int/";
const EOD_BASE = "https://dps.psx.com.pk/timeseries/eod/";

/** A tick is [epochSeconds, indexValue, volume, ...extras]. */
type SeriesPoint = [number, number, number, ...number[]];

interface DpsSeriesResponse {
  status: number;
  message: string;
  data: SeriesPoint[];
}

async function fetchSeries(
  url: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Promise<SeriesPoint[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "azee-trade-web/1.0 (market indices)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for ${url}`);
  }
  const body = (await response.json()) as DpsSeriesResponse;
  if (body.status !== 1 || !Array.isArray(body.data)) {
    throw new Error(`PSX returned a malformed series for ${url}`);
  }
  if (body.data.length === 0) {
    // PSX serves an empty intraday series outside trading hours; callers
    // that can fall back to EOD pass allowEmpty (see snapshot.ts).
    if (allowEmpty) return [];
    throw new Error(`PSX returned an empty series for ${url}`);
  }
  if (!Array.isArray(body.data[0]) || typeof body.data[0][1] !== "number") {
    throw new Error(`PSX returned a malformed series for ${url}`);
  }
  return body.data;
}

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Calendar day in Pakistan Standard Time, e.g. "2026-07-21". */
function pktDayKey(epochSeconds: number): string {
  return new Date(epochSeconds * 1000 + PKT_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** The market is OPEN when PSX is still emitting fresh ticks. */
const OPEN_TICK_MAX_AGE_SECONDS = 5 * 60;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A normalized index plus the epoch of its latest tick (for session status). */
interface IndexResult {
  quote: MarketIndexQuote;
  latestTs: number;
}

/**
 * Fetches and normalizes one index. Mirrors snapshot.ts: intraday gives
 * the live value during a session but is legitimately empty out of
 * hours, so an empty/failed intraday degrades to the latest EOD close
 * rather than failing the index.
 */
async function fetchIndex(code: string, name: string): Promise<IndexResult> {
  const [intraday, eod] = await Promise.all([
    fetchSeries(`${INTRADAY_BASE}${code}`, { allowEmpty: true }).catch(
      (error) => {
        console.warn(`PSX intraday unavailable for ${code}; using EOD:`, error);
        return [] as SeriesPoint[];
      },
    ),
    fetchSeries(`${EOD_BASE}${code}`),
  ]);

  const hasLiveTick = intraday.length > 0;
  const [latestTs, latestValue] = hasLiveTick ? intraday[0] : eod[0];
  const latestDay = pktDayKey(latestTs);

  // Previous close = newest EOD entry from an earlier PKT calendar day.
  const previous = eod.find(([ts]) => pktDayKey(ts) !== latestDay);
  if (!previous) {
    throw new Error(`PSX EOD series for ${code} lacks a previous close`);
  }
  const previousClose = previous[1];

  const changePoints = latestValue - previousClose;
  const changePercent = (changePoints / previousClose) * 100;

  return {
    quote: {
      code,
      name,
      value: round2(latestValue),
      changePercent: round2(changePercent),
      changePoints: round2(changePoints),
      direction: changePoints >= 0 ? "up" : "down",
      asOf: new Date(latestTs * 1000).toISOString(),
    },
    latestTs,
  };
}

/**
 * Fetches every index in parallel and returns the successful ones in
 * display order. A single index failing is tolerated (omitted); only a
 * total failure (no index resolved — PSX unreachable) throws.
 */
async function fetchIndices(): Promise<MarketIndicesResponse> {
  const settled = await Promise.allSettled(
    INDICES.map((i) => fetchIndex(i.code, i.name)),
  );

  const results: IndexResult[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      // Never fabricate a value for a failed index — log and omit it.
      console.error(`Index "${INDICES[i].code}" failed:`, result.reason);
    }
  });

  if (results.length === 0) {
    throw new Error("No PSX index resolved — the portal may be down");
  }

  // Session state and freshness come from the newest tick in the set;
  // out of hours every latestTs is an old EOD stamp, so status is CLOSED.
  const freshestTs = Math.max(...results.map((r) => r.latestTs));
  const status: MarketStatus =
    Date.now() / 1000 - freshestTs <= OPEN_TICK_MAX_AGE_SECONDS
      ? "OPEN"
      : "CLOSED";

  return {
    indices: results.map((r) => r.quote),
    status,
    asOf: new Date(freshestTs * 1000).toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: MarketIndicesResponse | null = null;

function cacheControl(status: MarketStatus): string {
  return status === "OPEN"
    ? "s-maxage=60, stale-while-revalidate=300"
    : "s-maxage=1800, stale-while-revalidate=86400";
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const indices = await fetchIndices();
    lastGood = indices;
    res.setHeader("Cache-Control", cacheControl(indices.status));
    res.status(200).json(indices);
  } catch (error) {
    console.error("Market indices fetch failed:", error);
    if (lastGood) {
      // Serve the last verified values, clearly labelled — never
      // fabricate market data.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PSX index data is temporarily unavailable",
    });
  }
}
