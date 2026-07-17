import { apiGet, mockResponse } from "../lib/apiClient";
import type { MeetingCalendarResponse } from "../types";
import type { PayoutsResponse } from "../types/payouts";

/**
 * Development fixture mirroring /api/calendar/agm. Every entry is a
 * real meeting copied from the live endpoint (verified Jul 17 2026),
 * covering the mid-July EOGM cluster that follows Pakistan's June
 * fiscal year-end plus two later AGMs. As with PAYOUTS_FIXTURE below,
 * do not invent or re-attribute entries — production always serves
 * live PSX data, and a dev fixture that looks real must be real.
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
      city: "Karachi",
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

/**
 * Development fixture mirroring /api/payouts/latest. Every entry is a
 * real announcement copied verbatim from the live endpoint (verified
 * Jul 17 2026) — company, sector, text and timestamps all belong
 * together as PSX reported them. Do not invent entries or re-attribute
 * a real announcement to a different company: a plausible-looking
 * payout is a fabricated market fact even in a dev-only fixture.
 *
 * The selection deliberately covers the awkward shapes so they're
 * exercised locally: a compound announcement (two payouts, hence no
 * single `percent`), a free-text rights issue, a rights issue with no
 * book closure, an (F) final, an (iii) third interim, and a bonus.
 * Production always serves live PSX data.
 */
const PAYOUTS_FIXTURE: PayoutsResponse = {
  payouts: [
    {
      symbol: "LOTCHEM",
      companyName: "Lotte Chemical Pakistan Limited",
      sector: "CHEMICAL",
      announcement: "15%(ii) (D)",
      kinds: ["dividend"],
      percent: 15,
      period: "interim",
      interimNumber: 2,
      announcedAt: "2026-07-16T10:58:00.000Z",
      bookClosureFrom: "2026-07-27",
      bookClosureTo: "2026-07-29",
      bookClosureRaw: "27/07/2026  - 29/07/2026",
    },
    {
      symbol: "DCR",
      companyName: "Dolmen City REIT",
      sector: "REAL ESTATE INVESTMENT TRUST",
      announcement: "6.6%(F) (D)",
      kinds: ["dividend"],
      percent: 6.6,
      period: "final",
      announcedAt: "2026-07-15T11:01:00.000Z",
      bookClosureFrom: "2026-07-25",
      bookClosureTo: "2026-07-27",
      bookClosureRaw: "25/07/2026  - 27/07/2026",
    },
    {
      symbol: "STL",
      companyName: "Supernet Technologies Limited",
      sector: "TECHNOLOGY & COMMUNICATION",
      announcement: "85% (R)",
      kinds: ["rights"],
      percent: 85,
      announcedAt: "2026-07-15T10:54:00.000Z",
    },
    {
      symbol: "ITANZ",
      companyName: "Itanz Technologies Limited",
      sector: "TECHNOLOGY & COMMUNICATION",
      announcement: "10% (B)",
      kinds: ["bonus"],
      percent: 10,
      announcedAt: "2026-07-10T11:54:00.000Z",
      bookClosureFrom: "2026-07-21",
      bookClosureTo: "2026-07-21",
      bookClosureRaw: "21/07/2026  - 21/07/2026",
    },
    {
      // Compound: two payouts in one announcement → no single percent.
      symbol: "HMB",
      companyName: "Habib Metropolitan Bank Limited",
      sector: "COMMERCIAL BANKS",
      announcement: "25%(i) (D) - 25%(i) (D)",
      kinds: ["dividend"],
      period: "interim",
      interimNumber: 1,
      announcedAt: "2026-04-24T11:35:00.000Z",
      bookClosureFrom: "2026-05-06",
      bookClosureTo: "2026-05-08",
      bookClosureRaw: "06/05/2026 - 06/05/2026 - 08/05/2026 - 08/05/2026",
    },
    {
      // Free-text rights terms — nuance a plain percentage would lose.
      symbol: "TCORP",
      companyName: "Tariq Corporation Limited",
      sector: "SUGAR & ALLIED INDUSTRIES",
      announcement: "23.855376% AT A PREMIUM RS.10/= PER SHARES (R)",
      kinds: ["rights"],
      percent: 23.855376,
      announcedAt: "2026-05-25T10:44:00.000Z",
    },
    {
      symbol: "OGDC",
      companyName: "Oil & Gas Development Company Limited",
      sector: "OIL & GAS EXPLORATION COMPANIES",
      announcement: "32.50%(iii) (D)",
      kinds: ["dividend"],
      percent: 32.5,
      period: "interim",
      interimNumber: 3,
      announcedAt: "2026-04-29T10:56:00.000Z",
      bookClosureFrom: "2026-05-12",
      bookClosureTo: "2026-05-13",
      bookClosureRaw: "12/05/2026 - 13/05/2026",
    },
  ],
  totalAvailable: 562,
  asOf: "2026-07-17T09:00:00.000Z",
  source: "psx",
};

/** Recent dividend / bonus / rights announcements from PSX. */
export async function getPayouts(): Promise<PayoutsResponse> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live payout announcements from the API route.
    return mockResponse(PAYOUTS_FIXTURE);
  }
  return apiGet<PayoutsResponse>("/api/payouts/latest");
}
