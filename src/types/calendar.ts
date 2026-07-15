/** A scheduled corporate meeting from PSX's AGM/EOGM calendar. */
export interface CorporateMeeting {
  symbol: string;
  companyName: string;
  /** As reported by PSX; AGM and EOGM are the observed values. */
  meetingType: "AGM" | "EOGM" | string;
  /** Meeting date, ISO YYYY-MM-DD. */
  date: string;
  /** Meeting time, HH:MM (24h), when provided. */
  time?: string;
  city?: string;
  /** Financial period the meeting covers, ISO YYYY-MM-DD. */
  periodEnd?: string;
}

/** Payload of /api/calendar/agm. */
export interface MeetingCalendarResponse {
  meetings: CorporateMeeting[];
  /** ISO time of the underlying PSX fetch. */
  asOf: string;
  /** Where the payload came from. */
  source: "psx" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}
