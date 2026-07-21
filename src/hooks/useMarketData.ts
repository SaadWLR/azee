import {
  getAllMarketQuotes,
  getFullIndices,
  getMarketIndices,
  getMarketSnapshot,
  getMarketWatchStats,
  getTickerQuotes,
} from "../services/marketService";
import { useAsyncData } from "./useAsyncData";

export function useMarketSnapshot() {
  /*
   * 75s: the snapshot endpoint's edge cache is s-maxage=60 during
   * market hours (confirmed in api/market/snapshot.ts, same window as
   * /api/market/watch), so the same slightly-above-the-cache-window
   * reasoning as useTickerQuotes applies. Outside sessions the
   * endpoint serves a 30-minute cache, so those polls are cheap edge
   * hits. Background refetches update the value in place — no
   * loading state (per useAsyncData's polling design) and the panel's
   * count-up glides from the displayed value rather than resetting.
   */
  return useAsyncData(getMarketSnapshot, { intervalMs: 75_000 });
}

/**
 * The five PSX benchmark indices, on the same 75s cadence as
 * useMarketSnapshot — /api/market/indices shares the snapshot endpoint's
 * cache-window reasoning (s-maxage=60 in-session), and background
 * refetches glide the panel's values in place with no flicker.
 */
export function useMarketIndices() {
  return useAsyncData(getMarketIndices, { intervalMs: 75_000 });
}

/**
 * The full 10-index benchmark table for the /indices page.
 *
 * 75s: /api/market/indices-full's edge cache is s-maxage=60 in-session,
 * so — same reasoning as useTickerQuotes/useMarketSnapshot — polling
 * slightly above the 60s window lands on freshly-revalidated edge
 * entries without defeating the cache. It matters a touch more here
 * because each origin miss costs two PSX fetches (indices + market-
 * watch), so staying just past the window avoids stampeding them.
 */
export function useFullIndices() {
  return useAsyncData(getFullIndices, { intervalMs: 75_000 });
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
