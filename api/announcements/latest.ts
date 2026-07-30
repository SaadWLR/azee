import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  AnnouncementsResponse,
  CompanyAnnouncement,
} from "../../src/types/announcements";

/**
 * GET /api/announcements/latest?count=50&offset=0
 *
 * Company announcements (corporate disclosures) from the PSX Data
 * Portal, normalized and paginated. The frontend never talks to PSX
 * directly, and nothing here is fabricated or summarized — each row is
 * the company's own filing title plus a link to PSX's original
 * document. A fetch failure serves the last known-good page or an
 * honest error.
 *
 * WHY NODE (not Edge): deployed probes (Jul 30 2026) showed PSX's
 * POST /announcements returns 462 "Forbidden Region — DOSarrest
 * Internet Security" to Vercel's Edge egress but 200 with the real
 * fragment from the Node (Lambda) runtime — the same split as
 * api/calendar/agm.ts and api/payouts/latest.ts, and the reverse of
 * Business Recorder's. Verified per-endpoint; reachability on this host
 * does not generalize. This file declares no `config.runtime`, which is
 * what pins it to Node — Vercel only switches a function to Edge when
 * one is exported (see api/news/latest.ts for the opposite case). The
 * block doubles as a self-check: if this endpoint ever answered from
 * Edge it would return 462, not data.
 *
 * The PSX adapter is inlined — no relative runtime imports between
 * compiled functions (see api/market/snapshot.ts for the
 * FUNCTION_INVOCATION_FAILED history). Type-only imports above are
 * erased at compile time and safe.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const ANNOUNCEMENTS_URL = "https://dps.psx.com.pk/announcements";
const PSX_ORIGIN = "https://dps.psx.com.pk";

/**
 * PSX's announcement-type selector. "C" is Companies Announcements —
 * the company disclosures this endpoint serves.
 *
 * This field is REQUIRED and non-obvious: an empty `type` makes PSX
 * answer HTTP 500 with a page titled "Not Found", which reads like a
 * broken endpoint rather than a missing argument. The other codes
 * (A=CDC, B=SECP, D=NCCPL, E=PSX notices) return a DIFFERENT column
 * layout — notices have no issuing company, so their first column is
 * the title, not a symbol. This parser is deliberately scoped to C
 * only; pointing it at another type would silently mis-column.
 */
const ANNOUNCEMENT_TYPE = "C";

/** PSX caps a page at 100 regardless of a larger `count` (verified). */
const MAX_COUNT = 100;
const DEFAULT_COUNT = 50;

/**
 * Sanity floor. PSX holds 221k+ company announcements, so a page that
 * parses almost nothing means the fragment changed shape — fall
 * through to lastGood rather than serve a misleadingly empty list.
 * Deliberately low (not `count`) because the LAST page of a filtered
 * query legitimately returns a short page.
 */
const MIN_ROWS = 5;

/** PSX publishes announcement times in Pakistan Standard Time (UTC+5). */
const PKT_OFFSET_HOURS = 5;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

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

/** "Jul 30, 2026" + "3:26 PM" (PKT) → ISO UTC. */
function parseAnnouncedAt(dateText: string, timeText: string): string | null {
  const d = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})$/.exec(dateText.trim());
  const t = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeText.trim());
  if (!d || !t) return null;
  const month = MONTHS[d[1].toLowerCase()];
  if (month === undefined) return null;
  let hour = Number(t[1]) % 12;
  if (/pm/i.test(t[3])) hour += 12;
  const utc = Date.UTC(
    Number(d[3]),
    month,
    Number(d[2]),
    hour - PKT_OFFSET_HOURS,
    Number(t[2]),
  );
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/**
 * The document cell. Verified empirically against 100 live rows rather
 * than assumed:
 *   - 91/100 carry a PDF at /download/document/{id}.pdf
 *   -  2/100 carry a PDF at /download/attachment/{id}-{n}.pdf
 *   -  7/100 carry NO PDF, only a scanned image opened from a
 *     data-images="{id}-{n}.gif" attribute (PSX renders it in a modal
 *     via /download/image/{id}-{n}.gif). All three URL forms were
 *     confirmed to return 200 with the right content-type.
 * Preferring the PDF and falling back to the image means every row
 * links to something real; a row with neither yields null rather than
 * a fabricated or dead link.
 */
function parseDocument(cell: string): {
  url: string | null;
  type: "pdf" | "image" | null;
  id: string | null;
} {
  const pdf = /href="(\/download\/(?:document|attachment)\/([^"]+?)\.pdf)"/.exec(
    cell,
  );
  if (pdf) {
    // "280587-1" (attachment) and "280583" (document) both reduce to
    // the filing id before the dash.
    return { url: PSX_ORIGIN + pdf[1], type: "pdf", id: pdf[2].split("-")[0] };
  }
  const image = /data-images="([^"]+)"/.exec(cell);
  if (image) {
    return {
      url: `${PSX_ORIGIN}/download/image/${image[1]}`,
      type: "image",
      id: image[1].split("-")[0],
    };
  }
  return { url: null, type: null, id: null };
}

/**
 * One fragment row → an announcement, or null if it does not parse.
 *
 * Columns (type=C): DATE · TIME · SYMBOL · NAME · TITLE · documents.
 * The symbol cell wraps the ticker in a link, so the ticker is read as
 * text rather than from an attribute; fund tickers legitimately carry a
 * hyphen ("MCBIM-FUNDS"), which the pattern allows — verified against
 * real rows, where 3 of 100 were hyphenated and none carried a trailing
 * flag of the XD kind seen on market-watch rows.
 */
function parseRow(row: string): CompanyAnnouncement | null {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  if (cells.length < 6) return null;

  const dateText = cellText(cells[0]);
  const timeText = cellText(cells[1]);
  const symbol = cellText(cells[2]);
  const companyName = cellText(cells[3]);
  const title = cellText(cells[4]);

  if (!symbol || !companyName || !title) return null;
  if (!/^[A-Z0-9][A-Z0-9.\-]*$/.test(symbol)) return null;

  const announcedAt = parseAnnouncedAt(dateText, timeText);
  if (!announcedAt) return null;

  const doc = parseDocument(cells[5]);

  return {
    // Fall back to the timestamp+symbol when PSX gives no document at
    // all, so React keys stay stable without inventing an id.
    id: doc.id ?? `${announcedAt}-${symbol}`,
    announcedAt,
    dateText,
    timeText,
    symbol,
    companyName,
    title,
    documentUrl: doc.url,
    documentType: doc.type,
  };
}

async function fetchAnnouncements(
  count: number,
  offset: number,
): Promise<AnnouncementsResponse> {
  const body = new URLSearchParams({
    type: ANNOUNCEMENT_TYPE,
    symbol: "",
    query: "",
    count: String(count),
    offset: String(offset),
    date_from: "",
    date_to: "",
    page: "annc",
  }).toString();

  const response = await fetch(ANNOUNCEMENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "azee-trade-web/1.0 (announcements)",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`PSX announcements responded ${response.status}`);
  }
  const html = await response.text();

  /*
   * Structural check: the fragment must actually be the announcements
   * table. PSX answers a malformed query with a full HTML error page
   * (HTTP 500, titled "Not Found"), which would otherwise parse to zero
   * rows and look like "no announcements today".
   */
  if (!html.includes("announcementsTable")) {
    throw new Error(
      "PSX announcements response did not contain #announcementsTable — contract or page may have changed",
    );
  }

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const announcements: CompanyAnnouncement[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) announcements.push(parsed);
  }
  if (announcements.length < MIN_ROWS) {
    throw new Error(
      `PSX announcements parse yielded only ${announcements.length} rows — fragment structure may have changed`,
    );
  }

  // PSX's own total for this query ("Showing 1 to 50 of 221831
  // entries"), mirrored by the pager's data-total attribute.
  const totalMatch = /of\s+(\d+)\s+entries/.exec(html);

  return {
    announcements,
    count,
    offset,
    totalAvailable: totalMatch ? Number(totalMatch[1]) : null,
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Clamps a query param to a sane integer, falling back to `fallback`. */
function intParam(raw: unknown, fallback: number, min: number, max: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Last good page, keyed by "count:offset" — a single slot would serve
 * page 1's rows under page 3's URL during an outage, which would read
 * as real data for the wrong page.
 */
const lastGood = new Map<string, AnnouncementsResponse>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const count = intParam(req.query.count, DEFAULT_COUNT, 1, MAX_COUNT);
  // 221k+ entries exist, but an unbounded offset is a cheap way to make
  // PSX scan the whole table; cap it well past any realistic browsing.
  const offset = intParam(req.query.offset, 0, 0, 500_000);
  const key = `${count}:${offset}`;

  try {
    const data = await fetchAnnouncements(count, offset);
    lastGood.set(key, data);
    /*
     * 15 minutes. Company announcements arrive continuously through the
     * trading day — 50 filings spanned roughly a day and a half when
     * measured, versus payouts' ~12 weeks — so this is deliberately
     * shorter than payouts' 30 minutes. It still caps origin load at
     * ~96 fetches/day per page, and older pages (offset > 0) are
     * effectively immutable history that the same window serves nearly
     * free from the edge.
     */
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (error) {
    console.error("PSX announcements fetch failed:", error);
    const cached = lastGood.get(key);
    if (cached) {
      // Serve the last verified page, clearly labelled — never an empty
      // table presented as "no announcements".
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
      res.status(200).json({ ...cached, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PSX company announcements are temporarily unavailable",
    });
  }
}

export { fetchAnnouncements };
