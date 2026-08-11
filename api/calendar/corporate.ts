import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CorporateMeeting,
  MeetingCalendarResponse,
} from "../../src/types/calendar";
import type {
  Payout,
  PayoutKind,
  PayoutPeriod,
  PayoutsResponse,
} from "../../src/types/payouts";

/**
 * GET /api/calendar/corporate?view=meetings | payouts
 *
 * The two halves of the Corporate Calendar behind one Vercel function.
 * They were two functions (api/calendar/agm.ts and api/payouts/latest.ts)
 * that are already presented as two tabs of one page, so they spent two
 * of the twelve Hobby function slots on a single feature.
 *
 * Unlike the PMEX and market-watch merges, these two do NOT share an
 * upstream call — /calendar and /payouts are different PSX endpoints
 * with different payload shapes, different sanity floors and different
 * cache strategies (the meetings window is clamped to PKT midnight; the
 * payouts window is a flat 30 minutes). This merge therefore reclaims a
 * function slot only; both code paths are preserved verbatim, including
 * their separate caching, and nothing is shared beyond the file.
 *
 * The public URLs are UNCHANGED — vercel.json rewrites
 * /api/calendar/agm and /api/payouts/latest onto this file with the
 * matching ?view=. Nothing in src/ or tests/ moves.
 *
 * WHY NODE (not Edge): deployed probes (Jul 2026) showed PSX's POST
 * /calendar and POST /payouts both return 462 (an anti-bot block page)
 * to Vercel's Edge egress but 200 with real data from the Node (Lambda)
 * runtime — the reverse of Business Recorder's split. Verified per
 * endpoint; reachability on this host does not generalize.
 *
 * The PSX adapters are inlined — no relative runtime imports between
 * compiled functions (a known FUNCTION_INVOCATION_FAILED cause on
 * Vercel with "type": "module"). Type-only imports above are erased at
 * compile time and safe.
 *
 * RUNTIME: Node.
 */

/*
 * Sentry, initialized inline rather than from a shared api/ module:
 * relative runtime imports between compiled functions are the known
 * FUNCTION_INVOCATION_FAILED cause noted above, and a shared init
 * module would be exactly that import. Bare package imports are fine.
 * No SENTRY_DSN → never initialized → silent no-op.
 */
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/* ── View: AGM/EOGM meetings ───────────────────────────────────── */

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

function normalizeMeeting(entry: PsxCalendarEntry): CorporateMeeting | null {
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
    const meeting = normalizeMeeting(entry);
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

/* ── View: dividend / bonus / rights payouts ───────────────────── */

const PAYOUTS_URL = "https://dps.psx.com.pk/payouts";

/**
 * PSX returns the table newest-first, so start=0 IS the recency
 * window — no date filtering needed, which is what a "calendar"
 * wants rather than the full historical backlog (~562 and growing).
 *
 * 50 because PSX caps a page at 50 regardless of this value —
 * verified live: length=50, 100 and 200 all return "Showing 1 to 50
 * of 562". Asking for more would silently get 50 anyway, so the
 * value states the truth. In practice the newest 50 spans ~3 months
 * (Apr 23 → Jul 16 when measured) and therefore covers every
 * still-upcoming book closure, since closures follow their
 * announcement by days-to-weeks. Reaching further back would need
 * paginating with start=50,100,… — extra origin requests for older
 * announcements a calendar has little use for.
 */
const FETCH_LENGTH = 50;

/**
 * Sanity floor (MIN_VALID_ROWS spirit): PSX holds 500+ announcements
 * and serves the newest 50 per page, so parsing fewer than 10 means
 * the fragment or the parse broke — fall through to lastGood/503
 * rather than serve a misleadingly thin calendar.
 */
const MIN_PAYOUTS = 10;

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** PSX publishes announcement times in Pakistan Standard Time (UTC+5). */
const PKT_OFFSET_HOURS = 5;

/** Cell text with tags stripped and whitespace collapsed. */
function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** "July 16, 2026 3:58 PM" (PKT) → ISO UTC. */
function parseAnnouncedAt(text: string): string | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
    text.trim(),
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  let hour = Number(m[4]) % 12;
  if (/pm/i.test(m[6])) hour += 12;
  const utc = Date.UTC(
    Number(m[3]),
    month,
    Number(m[2]),
    hour - PKT_OFFSET_HOURS,
    Number(m[5]),
  );
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/** "27/07/2026  - 29/07/2026" (DD/MM/YYYY) → ISO from/to. */
function parseBookClosure(text: string): Pick<
  Payout,
  "bookClosureFrom" | "bookClosureTo" | "bookClosureRaw"
> {
  const raw = text.trim();
  const dates = [...raw.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map(
    (m) => `${m[3]}-${m[2]}-${m[1]}`,
  );
  if (dates.length === 0) return {};
  return {
    bookClosureFrom: dates[0],
    bookClosureTo: dates[dates.length - 1],
    bookClosureRaw: raw,
  };
}

const KIND_BY_CODE: Record<string, PayoutKind> = {
  D: "dividend",
  B: "bonus",
  R: "rights",
};

/**
 * Derives structured fields from PSX's notation. Real observed forms:
 *   "15%(ii) (D)"  "6.6%(F) (D)"  "10% (B)"  "85% (R)"
 *   "25%(i) (D)  -  25%(i) (D)"                    (compound)
 *   "23.855376% AT A PREMIUM RS.10/= PER SHARES (R)" (free text)
 * Anything ambiguous is left undefined rather than guessed.
 */
function deriveFromAnnouncement(announcement: string) {
  const kinds: PayoutKind[] = [];
  for (const match of announcement.matchAll(/\((D|B|R)\)/g)) {
    const kind = KIND_BY_CODE[match[1]];
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }

  // Only report a percent when exactly one appears — a compound
  // announcement carries several and picking one would misrepresent it.
  const percents = [...announcement.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  const percent = percents.length === 1 ? Number(percents[0][1]) : undefined;

  let period: PayoutPeriod | undefined;
  let interimNumber: number | undefined;
  const interim = /\((i{1,3})\)/.exec(announcement);
  if (interim) {
    period = "interim";
    interimNumber = interim[1].length;
  } else if (/\(F\)/.test(announcement)) {
    period = "final";
  }

  return { kinds, percent, period, interimNumber };
}

function parsePayoutRow(row: string): Payout | null {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    cellText(m[1]),
  );
  if (cells.length < 6) return null;

  const [symbol, companyName, sector, announcement, announcedText, bookClosure] =
    cells;
  if (!symbol || !companyName || !announcement) return null;

  const announcedAt = parseAnnouncedAt(announcedText);
  if (!announcedAt) return null;

  const derived = deriveFromAnnouncement(announcement);
  // No recognizable instrument code means we can't honestly classify
  // the row — drop it rather than present an untyped payout.
  if (derived.kinds.length === 0) return null;

  return {
    symbol,
    companyName,
    sector,
    announcement,
    ...derived,
    announcedAt,
    ...parseBookClosure(bookClosure),
  };
}

/** Fetches and normalizes the live payouts table; raw HTML stays here. */
async function fetchPayouts(): Promise<PayoutsResponse> {
  const response = await fetch(PAYOUTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "azee-trade-web/1.0 (payouts)",
    },
    body: `start=0&length=${FETCH_LENGTH}`,
  });
  if (!response.ok) {
    throw new Error(`PSX payouts responded ${response.status}`);
  }
  const html = await response.text();

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const payouts: Payout[] = [];
  for (const row of rows) {
    const payout = parsePayoutRow(row);
    if (payout) payouts.push(payout);
  }
  if (payouts.length < MIN_PAYOUTS) {
    throw new Error(
      `PSX payouts parse yielded only ${payouts.length} rows — fragment structure may have changed`,
    );
  }

  const totalMatch = /of (\d+) entries/.exec(html);

  return {
    payouts,
    totalAvailable: totalMatch ? Number(totalMatch[1]) : undefined,
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/*
 * One lastGood PER VIEW, exactly as the two originals each had their
 * own. Sharing a single slot would let one view's outage serve the
 * other view's shape. Both survive warm invocations and are the
 * graceful answer when PSX is down.
 */
let lastGoodMeetings: MeetingCalendarResponse | null = null;
let lastGoodPayouts: PayoutsResponse | null = null;

/**
 * The meetings view. Cache windows are clamped to PKT midnight: a
 * cached body is served by the edge WITHOUT re-running this function,
 * so any window that outlived the PKT day the payload was built for
 * would keep serving meetings that are now in the past — the same
 * boundary bug as the UTC cutoff, reintroduced by the cache. Capping
 * every window at PKT midnight forces one revalidation just after it
 * (~1 extra origin fetch/day).
 */
async function handleMeetings(res: VercelResponse) {
  const boundary = secondsUntilPktMidnight();
  try {
    const calendar = await fetchMeetings();
    lastGoodMeetings = calendar;
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
    if (lastGoodMeetings) {
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
        ...lastGoodMeetings,
        meetings: lastGoodMeetings.meetings.filter((m) => m.date >= today),
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

/** The payouts view. Flat 30-minute window — see the comment inside. */
async function handlePayouts(res: VercelResponse) {
  try {
    const payouts = await fetchPayouts();
    lastGoodPayouts = payouts;
    /*
     * 30 minutes. Measured from the live table, the newest 50
     * announcements spanned ~12 weeks (~4/week baseline) but arrive in
     * results-season bursts — 21 landed across four days in late
     * April, up to 9 in a single day. A 30-minute window surfaces a
     * new announcement well within the day it breaks even during those
     * bursts, while capping origin load at ~48 fetches/day. It is
     * deliberately shorter than the meetings view's 1 hour, whose AGM
     * notices arrive roughly 3x less often and are filed weeks ahead;
     * payouts move faster and the book-closure dates they carry are
     * near-term.
     */
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(payouts);
  } catch (error) {
    console.error("PSX payouts fetch failed:", error);
    if (lastGoodPayouts) {
      // Serve the last verified announcements, clearly labelled —
      // never fabricate a payout figure or date.
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
      res.status(200).json({ ...lastGoodPayouts, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Payout announcements are temporarily unavailable",
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const view = String(req.query.view ?? "meetings");

  if (view === "meetings") return handleMeetings(res);
  if (view === "payouts") return handlePayouts(res);

  res.setHeader("Cache-Control", "no-store");
  res.status(400).json({
    error: `Unknown corporate calendar view "${view}" — expected "meetings" or "payouts"`,
  });
}
