/**
 * A LISTED company's profile and fundamentals, as PSX's Data Portal
 * publishes them (dps.psx.com.pk/company/<SYMBOL>).
 *
 * Deliberately not `types/company.ts`, which describes AZEE itself.
 * This file is about the companies AZEE's visitors look up.
 */

/** One person PSX names on a company's profile. */
export interface CompanyPerson {
  name: string;
  /** PSX's own wording: "CEO", "Chairperson", "Company Secretary"… */
  role: string;
}

/**
 * The profile block. Every field is optional because PSX genuinely
 * leaves them blank for some listings — a non-voting share class
 * (ANLNV) carries the headings with nothing under them. A caller that
 * finds `isEmpty` true should say the profile is not published, never
 * render an empty card that reads as a failed load.
 */
export interface CompanyProfile {
  description?: string;
  keyPeople: CompanyPerson[];
  address?: string;
  website?: string;
  registrar?: string;
  auditor?: string;
  fiscalYearEnd?: string;
  /** True when PSX published the section but filled in none of it. */
  isEmpty: boolean;
}

/**
 * One row of a financial or ratio table, carrying PSX's OWN label.
 *
 * The label is not normalized and must not be: PSX names this row by
 * sector — "Mark-up Earned" for banks, "Sales" for most companies,
 * "Total Income" for the exchange itself — and a bank's income
 * statement genuinely is a different shape, not a renamed one. Reading
 * these by position would quietly present one company's figure under
 * another's heading.
 *
 * `values` is aligned to the table's `periods`, one entry per column.
 * A null is a cell PSX printed empty — not a zero, and not a gap to
 * fill in. Figures keep PSX's own formatting, including parentheses
 * for negatives, so nothing is re-rounded or re-scaled here.
 */
export interface CompanyFinancialRow {
  label: string;
  values: (string | null)[];
}

/**
 * One table: its column headings and its rows.
 *
 * `periods` is however many columns PSX served — 1 to 4 for annuals,
 * because a recent listing genuinely has less history. Quarterly
 * columns are fiscal-year-relative labels ("Q3 2026") and there is no
 * Q4: PSX replaces it with the annual figure. Ratios can reach further
 * back than the financials do (GEMNETS: one annual column, two ratio
 * columns), so the three tables do not share a period list.
 */
export interface CompanyFinancialTable {
  periods: string[];
  rows: CompanyFinancialRow[];
}

/** A footnote marker PSX attaches to a figure, with PSX's own gloss. */
export interface CompanyFootnote {
  /** The marker as printed, e.g. "**". */
  marker: string;
  /** PSX's explanation, e.g. "Based on unconsolidated financials". */
  meaning: string;
}

/**
 * The fundamentals block.
 *
 * `peRatioTtm` is null when PSX prints "N/A" (it does, for companies
 * with no trailing profit). Its footnote markers travel with it in
 * `peFootnotes`: "**" means the figure is based on unconsolidated
 * financials, which changes what the number means, not merely how it
 * is decorated.
 *
 * Money figures keep PSX's formatting and PSX's unit. Market cap is
 * published in thousands and `marketCapNote` carries the units line
 * from the page itself rather than a unit this code assumed.
 */
export interface CompanyFundamentals {
  peRatioTtm: string | null;
  peFootnotes: string[];
  marketCapThousands: string | null;
  shares: string | null;
  freeFloatShares: string | null;
  freeFloatPercent: string | null;
  /** PSX's own units line for the tables, e.g. "All numbers in thousands (000's) except EPS". */
  unitsNote: string | null;
  annual: CompanyFinancialTable | null;
  quarterly: CompanyFinancialTable | null;
  ratios: CompanyFinancialTable | null;
}

/**
 * GET /api/company/detail?symbol=<SYM>.
 *
 * `kind` is "etf" when PSX redirects the symbol to its ETF page, which
 * carries neither of these sections. That is a clean, expected answer
 * for an ETF — not an error, and not an empty company page.
 *
 * `attribution` is Capital Stake's notice, read from the page and
 * scoped to the financials and ratios. It does not cover the profile
 * or the equity figures, which are PSX's own.
 */
export interface CompanyDetailResponse {
  symbol: string;
  kind: "company" | "etf";
  profile: CompanyProfile | null;
  fundamentals: CompanyFundamentals | null;
  footnotes: CompanyFootnote[];
  attribution: string | null;
  /** ISO time this was read from PSX. */
  asOf: string;
  source: "psx" | "cache";
  /** True when serving the last known-good read during an outage. */
  stale?: boolean;
}
