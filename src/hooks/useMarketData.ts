import {
  getAllMarketQuotes,
  getCommodities,
  getEtfs,
  getForex,
  getFullIndices,
  getGlobalFutures,
  getMarketIndices,
  getMarketSnapshot,
  getMarketWatchStats,
  getTickerQuotes,
} from "../services/marketService";
import { useAsyncData } from "./useAsyncData";

export function useMarketSnapshot() {
  /*
   * 75s: the KSE-100 snapshot is composed from /api/market/indices,
   * whose edge cache is s-maxage=60 during market hours (same window as
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
 * PMEX global index futures for the /indices "Global Futures" tab.
 *
 * 75s: /api/market/global-futures caches 60s while its data is live and
 * 1800s once the PMEX session is closed — same freshness-derived scheme
 * as indices-full. Polling just above the 60s live-window (same
 * reasoning as useFullIndices / useTickerQuotes) lands on freshly
 * revalidated edge entries during a session; when PMEX is closed the
 * long server cache means those polls are cheap edge hits.
 */
export function useGlobalFutures() {
  return useAsyncData(getGlobalFutures, { intervalMs: 75_000 });
}

/**
 * PMEX commodity futures for the /commodities page.
 *
 * 75s: /api/market/commodities uses the same freshness-derived caching
 * as global-futures — 60s while the underlying contracts are live,
 * 1800s once they have gone quiet — so the same reasoning carries over:
 * polling just above the 60s live window (as useFullIndices /
 * useTickerQuotes do) lands on freshly revalidated edge entries during
 * a session without defeating the cache, and once the commodity
 * sessions close the long server cache makes those polls cheap edge
 * hits. The cadence is deliberately identical to useGlobalFutures
 * because both read the same PMEX feed on the same server TTLs.
 */
export function useCommodities() {
  return useAsyncData(getCommodities, { intervalMs: 75_000 });
}

/**
 * PSX-listed ETFs for the /etfs page.
 *
 * 75s: /api/market/etfs reads the same PSX market-watch page as
 * /api/market/watch and shares its cache scheme (s-maxage=60 in
 * session, 1800s outside), so the same reasoning as useTickerQuotes
 * applies — polling just above the 60s window lands on freshly
 * revalidated edge entries without defeating the cache, and outside
 * the PKT session those polls are cheap edge hits.
 */
export function useEtfs() {
  return useAsyncData(getEtfs, { intervalMs: 75_000 });
}

/**
 * Mid-market PKR forex rates for the /forex page.
 *
 * NO polling, deliberately — and this is the one hook where a fast
 * cadence would be actively misleading. The source publishes once a
 * day; re-fetching every 75s like the live-market hooks would burn
 * requests to receive the identical payload and, worse, dress
 * once-daily data in the trappings of a live tape. One fetch per page
 * visit is already far fresher than the data changes, and the server
 * cache (derived from the source's own next-update time, capped at an
 * hour) is what guarantees a published update is picked up promptly.
 */
export function useForex() {
  return useAsyncData(getForex);
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
