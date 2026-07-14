import { apiGet, mockResponse } from "../lib/apiClient";
import type {
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
    // the live KSE-100 snapshot from the API route.
    return mockResponse(MARKET_SNAPSHOT);
  }
  return apiGet<MarketSnapshot>("/api/market/snapshot");
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
