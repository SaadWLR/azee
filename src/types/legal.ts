/**
 * A block of legal/compliance page content.
 *
 * Deliberately simple: headings, paragraphs and lists only. Legal text
 * is transcribed, never authored here, so the shape exists to carry
 * approved wording faithfully — not to enable rich composition.
 */
export type LegalBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "definitions"; items: { term: string; value: string }[] }
  /**
   * Downloadable documents. `href` points at the file where AZEE
   * already publishes it — the same link-to-the-original principle used
   * for PSX announcement PDFs, rather than rehosting a form whose
   * approved version could then drift out of sync.
   */
  | { kind: "downloads"; items: { label: string; href: string }[] };

/**
 * One legal / regulatory page.
 *
 * `blocks` carries real, already-approved content. A page with
 * `pending` instead has NO substantive content yet: the route and its
 * structure exist, and the page states plainly what is outstanding and
 * who to contact. This is the same discipline as the Knowledge Centre
 * modules — real structural metadata, never invented body text. Do not
 * add substantive legal wording to a pending page without it having
 * been approved: on a licensed brokerage, drafted-in-place legal text
 * is a liability, not a placeholder.
 */
export interface LegalPage {
  slug: string;
  /** Route path, e.g. "/privacy-policy". */
  path: string;
  title: string;
  /** Short eyebrow above the heading. */
  eyebrow: string;
  /** Meta description for the page head. */
  description: string;
  /** Effective date exactly as the approved source states it. */
  effectiveDate?: string;
  /** Where the approved wording came from, for maintainer traceability. */
  sourceNote?: string;
  blocks?: LegalBlock[];
  /** Set when the substantive content does not exist yet. */
  pending?: {
    /** What this page will contain once supplied. */
    summary: string;
    /** Precisely what is needed, so the gap is actionable not vague. */
    needed: string[];
  };
}
