import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CorporateMeeting,
  MeetingCalendarResponse,
} from "../../src/types/calendar";

/**
 * GET /api/calendar/agm
 *
 * Upcoming AGM/EOGM corporate meetings from the PSX Data Portal's
 * calendar endpoint, normalized and cached. The frontend never talks
 * to PSX directly, and nothing here is ever fabricated — a fetch
 * failure serves the last known-good payload or an honest error.
 *
 * WHY NODE (not Edge): deployed probes (Jul 15 2026) showed the
 * REVERSE of the Business Recorder split — PSX's POST /calendar
 * returns 462 (an anti-bot block page) to Vercel's Edge egress but
 * 200 with clean JSON from the Node (Lambda) runtime. Same
 * verify-both-runtimes discipline, opposite outcome; nothing about
 * this domain's reachability generalizes across endpoints.
 *
 * The PSX adapter is inlined — no relative runtime imports between
 * compiled functions (see api/market/snapshot.ts for the
 * FUNCTION_INVOCATION_FAILED history). Type-only imports above are
 * erased at compile time and safe.
 */

const CALENDAR_URL = "https://dps.psx.com.pk/calendar";

/**
 * Forward window. 90 days returned 18 meetings when probed (volume is
 * season-dependent — AGM filings cluster after fiscal year-ends), a
 * useful list without dragging in far-future noise.
 */
const WINDOW_DAYS = 90;

/**
 * Sanity floor (MIN_VALID_ROWS spirit): PSX lists 500+ companies,
 * each holding an AGM annually, so ZERO meetings across a 90-day
 * forward window is not a plausible real-world result — treat it as
 * a broken response and fall through to lastGood/503 rather than
 * serving a silently empty calendar.
 */
const MIN_MEETINGS = 1;

interface PsxCalendarEntry {
  id: number;
  symbol: string;
  name: string;
  type: string;
  date: string;
  time?: string;
  city?: string;
  period_end?: string;
}

interface PsxCalendarResponse {
  status: number;
  message: string;
  data: PsxCalendarEntry[];
}

/**
 * PSX trades in Pakistan Standard Time (UTC+05:00, no DST), so the
 * exchange's "today" — the day a meeting stops being upcoming — turns
 * over at PKT midnight, not UTC midnight. Deriving it from UTC (what
 * toISOString does) put the cutoff up to five hours late: between
 * 00:00 and 05:00 PKT the UTC date is still yesterday, so yesterday's
 * meetings kept being served as upcoming.
 */
const PKT_OFFSET_MS = 5 * 3600_000;

/** The PKT calendar date `offsetDays` from now, as YYYY-MM-DD. */
function pktDate(offsetDays = 0, now: Date = new Date()): string {
  return new Date(now.getTime() + PKT_OFFSET_MS + offsetDays * 86400_000)
    .toISOString()
    .slice(0, 10);
}

/** Seconds until the next PKT midnight — when "today" rolls over. */
function secondsUntilPktMidnight(now: Date = new Date()): number {
  const intoDay = (now.getTime() + PKT_OFFSET_MS) % 86400_000;
  return Math.ceil((86400_000 - intoDay) / 1000);
}

function normalize(entry: PsxCalendarEntry): CorporateMeeting | null {
  if (!entry.symbol || !entry.name || !entry.type || !entry.date) return null;
  if (Number.isNaN(new Date(entry.date).getTime())) return null;
  return {
    symbol: entry.symbol,
    companyName: entry.name,
    meetingType: entry.type,
    date: entry.date,
    time: entry.time || undefined,
    city: entry.city || undefined,
    periodEnd: entry.period_end || undefined,
  };
}

/** Fetches and normalizes the live calendar; raw PSX payload stays here. */
async function fetchMeetings(): Promise<MeetingCalendarResponse> {
  const today = pktDate();

  const response = await fetch(CALENDAR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "azee-trade-web/1.0 (agm calendar)",
    },
    body: `from=${today}&to=${pktDate(WINDOW_DAYS)}`,
  });
  if (!response.ok) {
    throw new Error(`PSX calendar responded ${response.status}`);
  }

  const body = (await response.json()) as PsxCalendarResponse;
  if (body.status !== 1 || !Array.isArray(body.data)) {
    throw new Error("PSX calendar returned a malformed payload");
  }

  const meetings: CorporateMeeting[] = [];
  for (const entry of body.data) {
    const meeting = normalize(entry);
    // PSX honors `from`, but filter on the way out too so the payload
    // can never carry a past-dated meeting even if it doesn't. Dates
    // are YYYY-MM-DD, so a string compare is a date compare.
    if (meeting && meeting.date >= today) meetings.push(meeting);
  }
  if (meetings.length < MIN_MEETINGS) {
    throw new Error(
      `PSX calendar yielded ${meetings.length} meetings across a ${WINDOW_DAYS}-day window — implausible, treating as broken`,
    );
  }

  meetings.sort((a, b) => a.date.localeCompare(b.date));

  return {
    meetings,
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: MeetingCalendarResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  /*
   * How long this payload stays true. A cached body is served by the
   * edge WITHOUT re-running this function, so any window that outlived
   * the PKT day the payload was built for would keep serving meetings
   * that are now in the past — the same boundary bug as the UTC cutoff,
   * reintroduced by the cache. Capping every window at PKT midnight
   * forces one revalidation just after it (~1 extra origin fetch/day).
   */
  const boundary = secondsUntilPktMidnight();

  try {
    const calendar = await fetchMeetings();
    lastGood = calendar;
    /*
     * 1 hour + a day of stale-while-revalidate: meeting notices are
     * filed days-to-weeks ahead of the meeting, so hourly freshness
     * is already generous, and it caps PSX's load at ~24 origin
     * fetches/day regardless of site traffic — both clamped to the
     * day boundary above.
     */
    res.setHeader(
      "Cache-Control",
      `s-maxage=${Math.min(3600, boundary)}, stale-while-revalidate=${Math.min(86400, boundary)}`,
    );
    res.status(200).json(calendar);
  } catch (error) {
    console.error("PSX calendar fetch failed:", error);
    if (lastGood) {
      /*
       * Serve the last verified calendar, clearly labelled — never
       * fabricate meeting data. Re-filtered to the current PKT day so
       * a payload captured before midnight can't resurface meetings
       * that have since passed.
       */
      const today = pktDate();
      res.setHeader(
        "Cache-Control",
        `s-maxage=${Math.min(300, boundary)}, stale-while-revalidate=${Math.min(86400, boundary)}`,
      );
      res.status(200).json({
        ...lastGood,
        meetings: lastGood.meetings.filter((m) => m.date >= today),
        stale: true,
        source: "cache",
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "The corporate meeting calendar is temporarily unavailable",
    });
  }
}

export { fetchMeetings };
