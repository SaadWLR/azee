import { apiGet, mockResponse } from "../lib/apiClient";
import type { MeetingCalendarResponse } from "../types";

/**
 * Development fixture mirroring /api/calendar/agm's shape (entries
 * modelled on the real mid-July-2026 EOGM cluster that follows
 * Pakistan's June fiscal year-end) — production always serves live
 * PSX data.
 */
const CALENDAR_FIXTURE: MeetingCalendarResponse = {
  meetings: [
    {
      symbol: "FML",
      companyName: "Feroze1888 Mills Limited",
      meetingType: "EOGM",
      date: "2026-07-20",
      time: "10:00",
      city: "Karachi",
      periodEnd: "2026-06-30",
    },
    {
      symbol: "SFL",
      companyName: "Sapphire Fibres Limited",
      meetingType: "EOGM",
      date: "2026-07-20",
      time: "11:00",
      city: "Lahore",
      periodEnd: "2026-06-30",
    },
    {
      symbol: "MUREB",
      companyName: "Murree Brewery Company Limited",
      meetingType: "EOGM",
      date: "2026-07-22",
      time: "10:00",
      city: "Rawalpindi",
      periodEnd: "2026-06-30",
    },
    {
      symbol: "COLG",
      companyName: "Colgate-Palmolive (Pakistan) Limited",
      meetingType: "AGM",
      date: "2026-09-24",
      time: "15:00",
      city: "Karachi",
      periodEnd: "2026-06-30",
    },
    {
      symbol: "PSX",
      companyName: "Pakistan Stock Exchange Limited",
      meetingType: "AGM",
      date: "2026-10-07",
      time: "16:00",
      city: "Karachi",
      periodEnd: "2026-06-30",
    },
  ],
  asOf: "2026-07-15T09:00:00.000Z",
  source: "psx",
};

/** Upcoming AGM/EOGM corporate meetings from the PSX calendar. */
export async function getCorporateCalendar(): Promise<MeetingCalendarResponse> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // the live calendar from the API route.
    return mockResponse(CALENDAR_FIXTURE);
  }
  return apiGet<MeetingCalendarResponse>("/api/calendar/agm");
}
