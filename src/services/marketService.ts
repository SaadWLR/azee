import { apiGet, mockResponse } from "../lib/apiClient";
import type {
  FullIndexQuote,
  FullIndicesResponse,
  IndexConstituent,
  IndexConstituentsResponse,
  MarketIndexQuote,
  MarketIndicesResponse,
  MarketSnapshot,
  MarketStat,
  MarketWatchResponse,
  StockQuote,
} from "../types";

/*
 * Fixtures reflect actual early-July-2026 PSX sessions (KSE-100 close
 * of Jul 6, 2026). Replace each mockResponse with apiGet against the
 * live feed (e.g. the PSX data portal at dps.psx.com.pk or a broker
 * market-data service) — payload shapes are already aligned.
 */

/** Development fixture — production always serves live PSX data. */
const MARKET_SNAPSHOT: MarketSnapshot = {
  index: {
    name: "KSE-100 Index",
    value: 187454.64,
    changePercent: 1.12,
    changePoints: 2082.49,
    direction: "up",
  },
  status: "OPEN",
  timestamp: "Karachi · PKT",
};

/**
 * Development fixture for /api/market/indices — the five PSX benchmark
 * indices (KSE-100 matches MARKET_SNAPSHOT above). Production always
 * serves live PSX data; these plausible values only exist so the panel
 * renders under `vite dev`, where the serverless route doesn't run.
 */
const MARKET_INDICES: MarketIndexQuote[] = [
  { code: "KSE100", name: "KSE-100", value: 187454.64, changePercent: 1.12, changePoints: 2082.49, direction: "up", asOf: "" },
  { code: "KSE30", name: "KSE-30", value: 57340.12, changePercent: 0.94, changePoints: 534.6, direction: "up", asOf: "" },
  { code: "ALLSHR", name: "KSE All Share", value: 117980.55, changePercent: 0.88, changePoints: 1029.3, direction: "up", asOf: "" },
  { code: "KMI30", name: "KMI-30", value: 271560.4, changePercent: 1.04, changePoints: 2795.1, direction: "up", asOf: "" },
  { code: "KMIALLSHR", name: "KMI All Share", value: 78420.18, changePercent: 0.71, changePoints: 553.0, direction: "up", asOf: "" },
];

/**
 * Development fixture for /api/market/indices-full — the 10 PSX
 * benchmark indices with high/low/change/volume (plausible values from
 * a real Jul 2026 session). Production always serves live PSX data;
 * these exist only so the /indices page renders under `vite dev`, where
 * the serverless route doesn't run. No value/turnover field — it isn't
 * a real PSX metric (see the endpoint).
 */
const FULL_INDICES: FullIndexQuote[] = [
  { code: "KSE100", name: "KSE-100 Index", value: 176133.56, high: 178370.45, low: 176062.69, changePoints: 205.83, changePercent: 0.12, direction: "up", volume: 448767016 },
  { code: "KSE30", name: "KSE-30 Index", value: 52663.9, high: 53395.41, low: 52629.57, changePoints: 48.09, changePercent: 0.09, direction: "up", volume: 106374502 },
  { code: "ALLSHR", name: "KSE All Share Index", value: 106568.82, high: 107857.74, low: 106600, changePoints: 149.03, changePercent: 0.14, direction: "up", volume: 1000676668 },
  { code: "KMI30", name: "KMI-30 Index", value: 247838.41, high: 251801.8, low: 247707.33, changePoints: 22.06, changePercent: 0.01, direction: "up", volume: 145607022 },
  { code: "KMIALLSHR", name: "KMI All Share Index", value: 68255.8, high: 69163.33, low: 68237.33, changePoints: 23.11, changePercent: 0.03, direction: "up", volume: 586069192 },
  { code: "PSXDIV20", name: "PSX Dividend 20 Index", value: 81542, high: 82487.88, low: 81508.55, changePoints: 211.13, changePercent: 0.26, direction: "up", volume: 35260948 },
  { code: "BKTI", name: "Banking Tradable Index", value: 50243.89, high: 50808.59, low: 50154.2, changePoints: 158.69, changePercent: 0.32, direction: "up", volume: 28247537 },
  { code: "OGTI", name: "Oil & Gas Tradable Index", value: 34622.41, high: 35221.12, low: 34589.95, changePoints: -120.21, changePercent: -0.35, direction: "down", volume: 7250801 },
  { code: "UPP9", name: "UBL Pakistan Enterprise Index", value: 62973.32, high: 63796.74, low: 62922.37, changePoints: 197.4, changePercent: 0.31, direction: "up", volume: 12436207 },
  { code: "NITPGI", name: "NIT Pakistan Gateway Index", value: 46622.29, high: 47201.51, low: 46577.3, changePoints: 96, changePercent: 0.21, direction: "up", volume: 20403831 },
];

/**
 * Development fixture mirroring /api/market/watch's stats array
 * (values from the real Jul 10, 2026 session) — production always
 * serves live PSX data.
 */
const WATCH_STATS: MarketStat[] = [
  { label: "Market Volume", value: "948.7M shares" },
  { label: "Advancers", value: "291", direction: "up" },
  { label: "Decliners", value: "170", direction: "down" },
  { label: "Symbols Traded", value: "494" },
];

/** Liquid PSX main-board symbols for the ticker tape. */
const TICKER_QUOTES: StockQuote[] = [
  { symbol: "OGDC", price: 226.4, changePercent: 1.84 },
  { symbol: "HBL", price: 142.75, changePercent: 2.1 },
  { symbol: "LUCK", price: 1148.0, changePercent: 0.92 },
  { symbol: "ENGRO", price: 318.5, changePercent: -0.41 },
  { symbol: "UBL", price: 372.2, changePercent: 1.47 },
  { symbol: "PSO", price: 384.1, changePercent: -1.18 },
  { symbol: "MEBL", price: 342.8, changePercent: 0.73 },
  { symbol: "FFC", price: 438.25, changePercent: 1.06 },
  { symbol: "SYS", price: 1924.0, changePercent: 2.38 },
  { symbol: "MARI", price: 692.3, changePercent: -0.64 },
  { symbol: "TRG", price: 64.85, changePercent: 3.21 },
  { symbol: "POL", price: 598.4, changePercent: 0.35 },
];

/**
 * Development fixture for the full Market Watch table — a
 * representative slice with all fields (change points + volume)
 * populated, so sort/filter/search all work locally. Production
 * serves the real ~490-symbol table from /api/market/watch. Note the
 * limits of the underlying PSX source: symbols only (no company
 * names), no sector names, no fundamentals — the page never
 * fabricates those.
 */
const MARKET_WATCH_FULL: StockQuote[] = [
  { symbol: "OGDC", price: 226.4, changePercent: 1.84, changePoints: 4.09, volume: 12734500, isKmi30: true, isKmiAllShare: true },
  { symbol: "HBL", price: 142.75, changePercent: 2.1, changePoints: 2.94, volume: 8901200 },
  { symbol: "LUCK", price: 1148.0, changePercent: 0.92, changePoints: 10.47, volume: 3120800, isKmi30: true, isKmiAllShare: true },
  { symbol: "ENGRO", price: 318.5, changePercent: -0.41, changePoints: -1.31, volume: 2450900 },
  { symbol: "UBL", price: 372.2, changePercent: 1.47, changePoints: 5.39, volume: 6710300 },
  { symbol: "PSO", price: 384.1, changePercent: -1.18, changePoints: -4.59, volume: 4980100, isKmi30: true, isKmiAllShare: true },
  { symbol: "MEBL", price: 342.8, changePercent: 0.73, changePoints: 2.48, volume: 3345600, isKmi30: true, isKmiAllShare: true },
  { symbol: "FFC", price: 438.25, changePercent: 1.06, changePoints: 4.6, volume: 5220400, isKmi30: true, isKmiAllShare: true },
  { symbol: "SYS", price: 1924.0, changePercent: 2.38, changePoints: 44.72, volume: 1890700, isKmi30: true, isKmiAllShare: true },
  { symbol: "MARI", price: 692.3, changePercent: -0.64, changePoints: -4.46, volume: 990500, isKmi30: true, isKmiAllShare: true },
  { symbol: "TRG", price: 64.85, changePercent: 3.21, changePoints: 2.02, volume: 15602300 },
  { symbol: "POL", price: 598.4, changePercent: 0.35, changePoints: 2.09, volume: 760200, isKmiAllShare: true },
  { symbol: "CNERGY", price: 9.34, changePercent: -0.64, changePoints: -0.06, volume: 50678372, isKmiAllShare: true },
  { symbol: "KEL", price: 8.16, changePercent: 2.77, changePoints: 0.22, volume: 47380226, isKmiAllShare: true },
  { symbol: "BAFL", price: 78.9, changePercent: 1.15, changePoints: 0.9, volume: 3410500 },
  { symbol: "PPL", price: 189.6, changePercent: -0.88, changePoints: -1.68, volume: 7220900, isKmi30: true, isKmiAllShare: true },
];

/** Index level, session statistics, and market status. */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // the live KSE-100 snapshot from the API route. asOf is stamped
    // fresh per call so the "updated Xs ago" indicator behaves like the
    // live endpoint (which always returns a real asOf) during dev.
    return mockResponse({ ...MARKET_SNAPSHOT, asOf: new Date().toISOString() });
  }
  return apiGet<MarketSnapshot>("/api/market/snapshot");
}

/** Live values for the five PSX benchmark indices (multi-index feed). */
export async function getMarketIndices(): Promise<MarketIndicesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as getMarketSnapshot: the serverless route doesn't
    // run under `vite dev`, so serve the fixture. asOf is stamped fresh
    // per call to mirror the live endpoint's real timestamps.
    const asOf = new Date().toISOString();
    return mockResponse({
      indices: MARKET_INDICES.map((index) => ({ ...index, asOf })),
      status: "OPEN",
      asOf,
      source: "psx",
    });
  }
  return apiGet<MarketIndicesResponse>("/api/market/indices");
}

/** The full PSX benchmark-index table (10 indices, derived volume). */
export async function getFullIndices(): Promise<FullIndicesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse({
      indices: FULL_INDICES,
      asOf: new Date().toISOString(),
      source: "psx",
    });
  }
  return apiGet<FullIndicesResponse>("/api/market/indices-full");
}

/**
 * Development fixture for /api/market/index-constituents — a handful of
 * real large-cap names so the drill-down sub-table renders under `vite
 * dev`. Production serves each index's true constituents from PSX.
 */
const CONSTITUENTS_FIXTURE: IndexConstituent[] = [
  { symbol: "OGDC", name: "Oil & Gas Development Company Limited", ldcp: 315.83, current: 314.5, change: -1.33, changePercent: -0.42, indexWeight: 6.12, indexPoints: -8.4, volume: 922098, freeFloat: 1075000000, marketCap: 1352000000000 },
  { symbol: "MARI", name: "Mari Energies Limited", ldcp: 650.27, current: 650, change: -0.27, changePercent: -0.04, indexWeight: 5.41, indexPoints: -0.5, volume: 229628, freeFloat: 240000000, marketCap: 156000000000 },
  { symbol: "HBL", name: "Habib Bank Limited", ldcp: 142.75, current: 145.1, change: 2.35, changePercent: 1.65, indexWeight: 4.87, indexPoints: 6.2, volume: 8901200, freeFloat: 900000000, marketCap: 213000000000 },
  { symbol: "LUCK", name: "Lucky Cement Limited", ldcp: 1148, current: 1160.5, change: 12.5, changePercent: 1.09, indexWeight: 4.12, indexPoints: 5.1, volume: 3120800, freeFloat: 190000000, marketCap: 341000000000 },
  { symbol: "FFC", name: "Fauji Fertilizer Company Limited", ldcp: 550.2, current: 548.83, change: -1.37, changePercent: -0.25, indexWeight: 3.9, indexPoints: -1.2, volume: 208087, freeFloat: 640000000, marketCap: 697000000000 },
  { symbol: "ENGRO", name: "Engro Holdings Limited", ldcp: 318.5, current: 316.4, change: -2.1, changePercent: -0.66, indexWeight: 3.44, indexPoints: -1.8, volume: 2450900, freeFloat: 340000000, marketCap: 182000000000 },
];

/** On-demand constituents of one index (drill-down). */
export async function getIndexConstituents(
  code: string,
): Promise<IndexConstituentsResponse> {
  if (import.meta.env.DEV) {
    // The serverless route doesn't run under `vite dev`; serve the
    // fixture so the drill-down renders locally.
    return mockResponse({
      code,
      count: CONSTITUENTS_FIXTURE.length,
      constituents: CONSTITUENTS_FIXTURE,
      asOf: new Date().toISOString(),
      source: "psx",
    });
  }
  return apiGet<IndexConstituentsResponse>(
    `/api/market/index-constituents?code=${encodeURIComponent(code)}`,
  );
}

/**
 * The ticker marquee was designed around a ~12-symbol track; passing
 * all ~490 listed symbols would multiply the track width ~40x and
 * turn the fixed-duration CSS loop into a blur. Keep the designed
 * visual density by showing the most active symbols by volume.
 */
const TICKER_SYMBOL_COUNT = 12;

/** Quotes for the scrolling ticker tape and watchlists. */
export async function getTickerQuotes(): Promise<StockQuote[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(TICKER_QUOTES);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return [...watch.quotes]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, TICKER_SYMBOL_COUNT);
}

/**
 * Live session stats (volume, breadth) from the market-watch feed.
 * A second call to /api/market/watch alongside getTickerQuotes() —
 * acceptable behind the endpoint's edge cache, matching the tradeoff
 * accepted in M3.
 */
export async function getMarketWatchStats(): Promise<MarketStat[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(WATCH_STATS);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return watch.stats;
}

/**
 * The FULL quotes array (all ~490 symbols) for the Market Watch page —
 * unlike getTickerQuotes' top-12 slice. Hits the same /api/market/watch
 * URL, so the apiClient dedup/TTL layer collapses it with the ticker's
 * and stats' requests within a page load and shares the endpoint's
 * edge cache.
 */
export async function getAllMarketQuotes(): Promise<StockQuote[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(MARKET_WATCH_FULL);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return watch.quotes;
}
