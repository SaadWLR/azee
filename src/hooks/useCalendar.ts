import { getCorporateCalendar } from "../services/calendarService";
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
