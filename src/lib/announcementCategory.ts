/**
 * AZEE's own filing-type tag for a PSX company announcement.
 *
 * TABLE VERSION 2 — the corrected and expanded table. Version 1 shipped
 * in f087d91; a read-through of a live 100-filing batch then found one
 * false positive and several misses, and v2 fixes exactly those:
 *
 *   · "agm", "egm" and "cbs" now match only as WHOLE WORDS. As plain
 *     substrings, "egm" matched inside "segment", so all 17 PSX filings
 *     mentioning a segment ("…Expansion in Retail Segment", "Removal from
 *     Non-Compliance Segment…") landed in Meetings. Every other keyword
 *     still matches as a substring — the risk was specific to these
 *     three-letter tokens, not to the approach.
 *   · Five keywords added for real titles v1 missed: "right issue",
 *     "bonus share", "intention to acquire" (Actions); "board of directors
 *     meeting", "bod meeting" (Meetings); "unusual movement" (Material).
 *
 * Nothing else changed from v1. Known, accepted limits of a title-only
 * table stay as they are: PSX's own "FINANCIAL STATMENTS" typo is not
 * matched, daily fund dividend distributions count as Actions, "take
 * over regulations" disclosures land in Actions, a bare "5.6.4" clause
 * reference counts as Insiders, and "decisions of the board meeting"
 * filings count as Meetings.
 *
 * NOT A PSX FIELD. PSX publishes no category for a disclosure; this is a
 * label AZEE derives from the filing's own title, and the page says so
 * wherever the tag is shown. It narrows what is on screen — it never
 * reinterprets a filing, and the title itself is always shown verbatim.
 *
 * DETERMINISTIC BY DESIGN. An ordered keyword table, matched
 * case-insensitively against the verbatim title, first match wins. No
 * model call, no scoring, no guess: the same title always gets the same
 * tag, and anyone can read this table to see why a filing landed where
 * it did.
 *
 * Priority matters because titles overlap. "Board Meeting to consider
 * Financial Results" names both a meeting and financials; Meetings is
 * checked first, so it is a meeting — the filing announces the meeting,
 * not the results.
 *
 * Pure and dependency-free, so it is unit-testable on its own and can
 * be imported by anything — including a plain Node script reading live
 * titles.
 */

export type Category =
  | "financials"
  | "material"
  | "actions"
  | "insiders"
  | "meetings"
  | "briefings"
  | "other";

/** Tab order on the page. Deliberately NOT the matching priority below. */
export const CATEGORY_TABS: ReadonlyArray<{ id: Category; label: string }> = [
  { id: "financials", label: "Financials" },
  { id: "material", label: "Material" },
  { id: "actions", label: "Actions" },
  { id: "insiders", label: "Insiders" },
  { id: "meetings", label: "Meetings" },
  { id: "briefings", label: "Briefings" },
  { id: "other", label: "Other" },
];

/**
 * Matching priority — first rule with any keyword present wins.
 * Keywords are lowercase; the title is lowercased once before matching.
 */
export const CATEGORY_RULES: ReadonlyArray<{
  category: Exclude<Category, "other">;
  keywords: readonly string[];
}> = [
  {
    category: "meetings",
    keywords: [
      "board meeting",
      "board of directors meeting",
      "bod meeting",
      "annual general meeting",
      "agm",
      "extraordinary general meeting",
      "egm",
    ],
  },
  {
    category: "briefings",
    keywords: ["corporate briefing session", "cbs", "analyst briefing"],
  },
  {
    category: "insiders",
    keywords: ["disclosure of interest by", "relevant person", "5.6.4"],
  },
  {
    category: "actions",
    keywords: [
      "buy-back",
      "buyback",
      "rights issue",
      "right issue",
      "bonus issue",
      "bonus share",
      "intention to acquire",
      "issuance of shares",
      "dividend",
      "merger",
      "acquisition",
      "take over",
      "takeover",
      "public offer",
    ],
  },
  {
    category: "material",
    keywords: ["material information", "material disclosure", "unusual movement"],
  },
  {
    category: "financials",
    keywords: [
      "financial result",
      "financial statements",
      "quarterly report",
      "annual report",
      "fund manager report",
      "fmr of",
      "auditors certificate",
    ],
  },
];

/**
 * The three-letter tokens that must match as whole words. As substrings
 * they fire inside ordinary words — "egm" inside "segment" — so they only
 * count when bounded by a non-alphanumeric character or the start or end
 * of the title: "EGM 2025", "EGM-26", "(CBS)", a title that is just "EGM".
 * Every other keyword is a phrase long enough that substring matching is
 * safe, and keeps it.
 *
 * The title is lowercased before matching, so [^a-z0-9] is the complete
 * boundary set.
 */
const WHOLE_WORD_KEYWORDS: ReadonlyMap<string, RegExp> = new Map(
  ["agm", "egm", "cbs"].map((keyword) => [
    keyword,
    new RegExp(`(^|[^a-z0-9])${keyword}($|[^a-z0-9])`),
  ]),
);

function matchesKeyword(haystack: string, keyword: string): boolean {
  const wholeWord = WHOLE_WORD_KEYWORDS.get(keyword);
  return wholeWord ? wholeWord.test(haystack) : haystack.includes(keyword);
}

/** The filing type AZEE assigns to a title. Falls through to "other". */
export function categorize(title: string): Category {
  const haystack = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(haystack, keyword))) {
      return rule.category;
    }
  }
  return "other";
}

/** Narrows an untrusted string (a URL param) to a real category id. */
export function isCategory(value: string): value is Category {
  return CATEGORY_TABS.some((tab) => tab.id === value);
}
