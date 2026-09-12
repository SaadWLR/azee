/**
 * AZEE's own filing-type tag for a PSX company announcement.
 *
 * NOT A PSX FIELD. PSX publishes no category for a disclosure; this is a
 * label AZEE derives from the filing's own title, and the page says so
 * wherever the tag is shown. It narrows what is on screen — it never
 * reinterprets a filing, and the title itself is always shown verbatim.
 *
 * DETERMINISTIC BY DESIGN. An ordered keyword table, matched as a
 * case-insensitive substring against the verbatim title, first match
 * wins. No model call, no scoring, no guess: the same title always gets
 * the same tag, and anyone can read this table to see why a filing
 * landed where it did.
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
      "bonus issue",
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
    keywords: ["material information", "material disclosure"],
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

/** The filing type AZEE assigns to a title. Falls through to "other". */
export function categorize(title: string): Category {
  const haystack = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category;
    }
  }
  return "other";
}

/** Narrows an untrusted string (a URL param) to a real category id. */
export function isCategory(value: string): value is Category {
  return CATEGORY_TABS.some((tab) => tab.id === value);
}
