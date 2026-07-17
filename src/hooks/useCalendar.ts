import { getCorporateCalendar, getPayouts } from "../services/calendarService";
import { useAsyncData } from "./useAsyncData";

export function useCorporateCalendar() {
  /*
   * No polling: the endpoint's edge cache is one hour and PSX files
   * meeting notices days-to-weeks ahead of the meeting — one fetch
   * per page visit is already far fresher than the data's real
   * cadence. A poll interval here would only re-read the same cached
   * payload.
   */
  return useAsyncData(getCorporateCalendar);
}

export function usePayouts() {
  /*
   * No polling either. The endpoint's edge cache is 30 minutes and
   * announcements arrive ~4/week (bursting to ~9/day only in results
   * season), so a poll would almost always re-read the same cached
   * payload; one fetch per page visit is already far fresher than the
   * data changes.
   */
  return useAsyncData(getPayouts);
}
