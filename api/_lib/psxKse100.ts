import type {
  MarketSnapshot,
  MarketStat,
  MarketStatus,
} from "../../src/types";

/*
 * PSX Data Portal adapter for the KSE-100 index.
 *
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

/**
 * Session stats beyond the index itself (volume, value, sector moves)
 * come from other DPS endpoints scheduled for a later phase; until
 * then the snapshot carries the Phase-1 placeholder rows unchanged.
 */
const PLACEHOLDER_STATS: MarketStat[] = [
  { label: "Market Volume", value: "703.7M shares" },
  { label: "Market Value", value: "PKR 38.8B" },
  { label: "Top Gaining Sector", value: "Commercial Banks", direction: "up" },
  { label: "Top Loser", value: "Textile Composite", direction: "down" },
  { label: "IPOs", value: "2 Upcoming" },
];

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
 * payload never leaves this module.
 */
export async function fetchKse100Snapshot(): Promise<MarketSnapshot> {
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
    stats: PLACEHOLDER_STATS,
    status,
    timestamp: "Karachi · PKT",
    asOf: new Date(latestTs * 1000).toISOString(),
    source: "psx",
  };
}
