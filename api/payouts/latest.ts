import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  Payout,
  PayoutKind,
  PayoutPeriod,
  PayoutsResponse,
} from "../../src/types/payouts";

/**
 * GET /api/payouts/latest
 *
 * The most recent dividend / bonus / rights announcements from the PSX
 * Data Portal's payouts table, normalized and cached. The frontend
 * never talks to PSX directly, and nothing here is fabricated — a
 * fetch failure serves the last known-good payload or an honest error.
 *
 * WHY NODE (not Edge): deployed probes (Jul 17 2026) showed PSX's
 * POST /payouts returns 462 (an anti-bot block page) to Vercel's Edge
 * egress but 200 with the real fragment from the Node (Lambda)
 * runtime — the same split as api/calendar/agm.ts, and the reverse of
 * Business Recorder's. Verified per-endpoint; reachability on this
 * host does not generalize.
 *
 * The PSX adapter is inlined — no relative runtime imports between
 * compiled functions (see api/market/snapshot.ts for the
 * FUNCTION_INVOCATION_FAILED history). Type-only imports above are
 * erased at compile time and safe.
 */

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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

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
  const percent =
    percents.length === 1 ? Number(percents[0][1]) : undefined;

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

function parseRow(row: string): Payout | null {
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
    const payout = parseRow(row);
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

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: PayoutsResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const payouts = await fetchPayouts();
    lastGood = payouts;
    /*
     * 30 minutes. Measured from the live table, the newest 50
     * announcements spanned ~12 weeks (~4/week baseline) but arrive in
     * results-season bursts — 21 landed across four days in late
     * April, up to 9 in a single day. A 30-minute window surfaces a
     * new announcement well within the day it breaks even during those
     * bursts, while capping origin load at ~48 fetches/day. It is
     * deliberately shorter than api/calendar/agm.ts's 1 hour, whose
     * AGM notices arrive roughly 3x less often and are filed weeks
     * ahead; payouts move faster and the book-closure dates they carry
     * are near-term.
     */
    res.setHeader(
      "Cache-Control",
      "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(payouts);
  } catch (error) {
    console.error("PSX payouts fetch failed:", error);
    if (lastGood) {
      // Serve the last verified announcements, clearly labelled —
      // never fabricate a payout figure or date.
      res.setHeader(
        "Cache-Control",
        "s-maxage=300, stale-while-revalidate=86400",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Payout announcements are temporarily unavailable",
    });
  }
}

export { fetchPayouts };
