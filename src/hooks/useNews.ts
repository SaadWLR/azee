import { getLatestNews } from "../services/newsService";
import { useAsyncData } from "./useAsyncData";

export function useLatestNews() {
  /*
   * 6 minutes. The /api/news/latest edge cache is s-maxage=300, and
   * (mirroring useTickerQuotes' 75s-for-a-60s-cache reasoning) polling
   * just above the cache window keeps a long-lived, open tab's
   * headlines fresh while every poll lands on a freshly-revalidated
   * edge entry rather than defeating the cache. News changes
   * story-by-story, not tick-by-tick, so a slow poll is plenty.
   */
  return useAsyncData(getLatestNews, { intervalMs: 360_000 });
}
