/**
 * One company announcement (corporate disclosure) as filed with the
 * Pakistan Stock Exchange.
 *
 * Every field is transcribed from PSX's own disclosure listing. Nothing
 * here is summarized, rewritten, or otherwise synthesized — the title
 * is the company's own filing title verbatim, and the link points at
 * PSX's original document rather than a rehosted or reinterpreted copy.
 * That is deliberate: an announcement is a regulatory disclosure, and
 * paraphrasing one would put words in a listed company's mouth.
 */
export interface CompanyAnnouncement {
  /** PSX document id, e.g. "280583" — unique per filing. */
  id: string;
  /** ISO UTC timestamp built from PSX's PKT date + time columns. */
  announcedAt: string;
  /** Date exactly as PSX renders it, e.g. "Jul 30, 2026". */
  dateText: string;
  /** Time exactly as PSX renders it, e.g. "3:26 PM" (PKT). */
  timeText: string;
  /** Ticker, e.g. "OGDC". Fund tickers are hyphenated ("MCBIM-FUNDS"). */
  symbol: string;
  companyName: string;
  /** The filing's own title, verbatim. */
  title: string;
  /**
   * Link to PSX's original document. Absolute URL on dps.psx.com.pk.
   * Null only if PSX published a row with no retrievable file at all.
   */
  documentUrl: string | null;
  /**
   * Which artifact `documentUrl` points at. Most filings are PDFs; a
   * minority (~7% observed) are published only as a scanned image, and
   * those are surfaced as-is rather than dropped or shown as a dead
   * "PDF" link that would not open one.
   */
  documentType: "pdf" | "image" | null;
}

/** Response for GET /api/announcements/latest. */
export interface AnnouncementsResponse {
  announcements: CompanyAnnouncement[];
  /** Echo of the page actually served, so the UI never guesses. */
  count: number;
  offset: number;
  /**
   * PSX's own total for this query, read from its "Showing X to Y of Z
   * entries" header — a real figure, never a client-side estimate.
   */
  totalAvailable: number | null;
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
