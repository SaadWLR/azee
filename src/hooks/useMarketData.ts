import { getMarketSnapshot, getTickerQuotes } from "../services/marketService";
import { useAsyncData } from "./useAsyncData";

export function useMarketSnapshot() {
  return useAsyncData(getMarketSnapshot);
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
