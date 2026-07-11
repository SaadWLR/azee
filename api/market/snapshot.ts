import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { MarketSnapshot, MarketStatus } from "../../src/types";

/**
 * GET /api/market/snapshot
 *
 * Live KSE-100 snapshot, normalized to the MarketSnapshot interface.
 * The frontend never talks to PSX directly (no CORS on the portal,
 * and the raw payload stays server-side).
 *
 * The PSX adapter is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects. Type-only imports above are erased at
 * compile time and safe.
 *
 * Caching: Vercel edge honours s-maxage, so PSX sees at most one
 * request per cache window regardless of traffic. Shorter during the
 * trading session, longer once the market is closed.
 */

/*
 * ── PSX Data Portal adapter (KSE-100) ─────────────────────────────
 * Endpoints (verified Jul 9, 2026 — see docs/market-data-research.md):
 *   /timeseries/int/KSE100 — intraday [[epochSec, value, volume], …],
 *     newest first, ~15-second resolution
 *   /timeseries/eod/KSE100 — daily [[epochSec, close, volume, …], …],
 *     newest first
 */

const INTRADAY_URL = "https://dps.psx.com.pk/timeseries/int/KSE100";
const EOD_URL = "https://dps.psx.com.pk/timeseries/eod/KSE100";

/** A tick is [epochSeconds, indexValue, volume, ...extras]. */
type SeriesPoint = [number, number, number, ...number[]];

interface DpsSeriesResponse {
  status: number;
  message: string;
  data: SeriesPoint[];
}

/*
 * This payload carries no session stats. Live Market Volume and
 * breadth come from /api/market/watch; the former placeholder rows
 * were removed as unfabricatable from current sources: Market Value
 * (no traded-value column on market-watch), sector gainers/losers
 * (sector column carries numeric codes with no name mapping), and
 * IPOs (eipo.psx.com.pk is JS-rendered — candidate for a dedicated
 * research milestone). Nothing here may ever be hardcoded.
 */

async function fetchSeries(url: string): Promise<SeriesPoint[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "azee-trade-web/1.0 (market snapshot)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for ${url}`);
  }
  const body = (await response.json()) as DpsSeriesResponse;
  if (
    body.status !== 1 ||
    !Array.isArray(body.data) ||
    body.data.length === 0 ||
    !Array.isArray(body.data[0]) ||
    typeof body.data[0][1] !== "number"
  ) {
    throw new Error(`PSX returned an empty or malformed series for ${url}`);
  }
  return body.data;
}

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Calendar day in Pakistan Standard Time, e.g. "2026-07-09". */
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

/**
 * Fetches and normalizes the live KSE-100 snapshot. The raw PSX
 * payload never leaves this function.
 */
async function fetchKse100Snapshot(): Promise<MarketSnapshot> {
  const [intraday, eod] = await Promise.all([
    fetchSeries(INTRADAY_URL),
    fetchSeries(EOD_URL),
  ]);

  const [latestTs, latestValue] = intraday[0];
  const latestDay = pktDayKey(latestTs);

  // Previous close = newest EOD entry from an earlier PKT calendar day
  // (the newest entry is the running/current session once it exists).
  const previous = eod.find(([ts]) => pktDayKey(ts) !== latestDay);
  if (!previous) {
    throw new Error("PSX EOD series lacks a previous session close");
  }
  const previousClose = previous[1];

  const changePoints = latestValue - previousClose;
  const changePercent = (changePoints / previousClose) * 100;

  const status: MarketStatus =
    Date.now() / 1000 - latestTs <= OPEN_TICK_MAX_AGE_SECONDS
      ? "OPEN"
      : "CLOSED";

  return {
    index: {
      name: "KSE-100 Index",
      value: round2(latestValue),
      changePercent: round2(changePercent),
      changePoints: round2(changePoints),
      direction: changePoints >= 0 ? "up" : "down",
    },
    status,
    timestamp: "Karachi · PKT",
    asOf: new Date(latestTs * 1000).toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: MarketSnapshot | null = null;

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
    const snapshot = await fetchKse100Snapshot();
    lastGood = snapshot;
    res.setHeader("Cache-Control", cacheControl(snapshot.status));
    res.status(200).json(snapshot);
  } catch (error) {
    console.error("KSE-100 snapshot fetch failed:", error);
    if (lastGood) {
      // Serve the last verified value, clearly labelled — never
      // fabricate market data.
      res.setHeader(
        "Cache-Control",
        "s-maxage=30, stale-while-revalidate=600",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "KSE-100 market data is temporarily unavailable",
    });
  }
}
