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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  const today = new Date();
  const to = new Date(today.getTime() + WINDOW_DAYS * 86400_000);

  const response = await fetch(CALENDAR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "azee-trade-web/1.0 (agm calendar)",
    },
    body: `from=${isoDate(today)}&to=${isoDate(to)}`,
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
    if (meeting) meetings.push(meeting);
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
  try {
    const calendar = await fetchMeetings();
    lastGood = calendar;
    /*
     * 1 hour + a day of stale-while-revalidate: meeting notices are
     * filed days-to-weeks ahead of the meeting, so hourly freshness
     * is already generous, and it caps PSX's load at ~24 origin
     * fetches/day regardless of site traffic.
     */
    res.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).json(calendar);
  } catch (error) {
    console.error("PSX calendar fetch failed:", error);
    if (lastGood) {
      // Serve the last verified calendar, clearly labelled — never
      // fabricate meeting data.
      res.setHeader(
        "Cache-Control",
        "s-maxage=300, stale-while-revalidate=86400",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "The corporate meeting calendar is temporarily unavailable",
    });
  }
}

export { fetchMeetings };
