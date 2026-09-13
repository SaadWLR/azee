import { getEconomicDashboard } from "../services/economicService";
import { useAsyncData } from "./useAsyncData";

export function useEconomicDashboard() {
  /*
   * No polling. The snapshot is rewritten at most once a day, by the
   * evening cron, and the endpoint's edge cache is three hours — the
   * underlying series themselves move weekly at the fastest (reserves)
   * and quarterly at the slowest (GDP, debt). One fetch per page visit
   * is already far fresher than the data; a poll would only re-read the
   * same cached snapshot.
   */
  return useAsyncData(getEconomicDashboard);
}
