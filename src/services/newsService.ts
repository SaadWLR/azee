import { mockResponse } from "../lib/apiClient";
import type { NewsItem } from "../types";

/*
 * Placeholder market-news feed — no consumer yet. Wire a headlines
 * strip or news page to getMarketNews() and swap the fixture for
 * apiGet against a news provider when one is selected.
 */

const MARKET_NEWS: NewsItem[] = [
  {
    id: "news-1",
    headline: "KSE-100 closes higher as banks lead post-budget recovery",
    source: "Market Desk",
    publishedAt: "2026-07-06T16:30:00+05:00",
  },
  {
    id: "news-2",
    headline: "SBP monetary policy meeting scheduled for late July",
    source: "Market Desk",
    publishedAt: "2026-07-03T11:00:00+05:00",
  },
  {
    id: "news-3",
    headline: "Two IPOs enter book-building on the PSX primary market",
    source: "Market Desk",
    publishedAt: "2026-07-01T09:45:00+05:00",
  },
];

/** Latest market headlines, newest first. */
export async function getMarketNews(): Promise<NewsItem[]> {
  // return apiGet<NewsItem[]>("/news/market");
  return mockResponse(MARKET_NEWS);
}
