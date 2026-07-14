import {
  getAllMarketQuotes,
  getMarketSnapshot,
  getMarketWatchStats,
  getTickerQuotes,
} from "../services/marketService";
import { useAsyncData } from "./useAsyncData";

export function useMarketSnapshot() {
  return useAsyncData(getMarketSnapshot);
}

/**
 * No polling: matches useMarketSnapshot's cadence — the snapshot
 * panel refreshes on page load for now, consistent across its data.
 */
export function useMarketWatchStats() {
  return useAsyncData(getMarketWatchStats);
}

export function useTickerQuotes() {
  /*
   * 75s: the watch endpoint's edge cache is s-maxage=60 during market
   * hours, so polling faster than 60s would only re-read the same
   * cached payload (or, worse, stampede origin refreshes). Slightly
   * above the cache window means most polls land on a freshly
   * revalidated edge entry without ever defeating the cache.
   */
  return useAsyncData(getTickerQuotes, { intervalMs: 75_000 });
}

export function useAllMarketQuotes() {
  /*
   * Same 75s cadence and same /api/market/watch URL as useTickerQuotes
   * — not a new fetch cadence. The apiClient dedup/TTL layer already
   * collapses concurrent same-URL requests, so the Market Watch page's
   * poll rides the same endpoint and edge-cache window.
   */
  return useAsyncData(getAllMarketQuotes, { intervalMs: 75_000 });
}
