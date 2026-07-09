import { apiGet, mockResponse } from "../lib/apiClient";
import type { MarketSnapshot, StockQuote } from "../types";

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
  stats: [
    { label: "Market Volume", value: "703.7M shares" },
    { label: "Market Value", value: "PKR 38.8B" },
    { label: "Top Gaining Sector", value: "Commercial Banks", direction: "up" },
    { label: "Top Loser", value: "Textile Composite", direction: "down" },
    { label: "IPOs", value: "2 Upcoming" },
  ],
  status: "OPEN",
  timestamp: "Karachi · PKT",
};

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

/** Quotes for the scrolling ticker tape and watchlists. */
export async function getTickerQuotes(): Promise<StockQuote[]> {
  // return apiGet<StockQuote[]>("/market/ticker");
  return mockResponse(TICKER_QUOTES);
}
