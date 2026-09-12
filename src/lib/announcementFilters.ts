import type { CompanyAnnouncement } from "../types/announcements";
import type { StockQuote } from "../types";
import { categorize, CATEGORY_TABS, type Category } from "./announcementCategory";

/**
 * Client-side narrowing of one PSX batch of announcements.
 *
 * Two INDEPENDENT stages, kept in separate functions on purpose:
 *
 *   1. Sector / Shariah-compliance need Market Watch — a filing's symbol
 *      has to be looked up to learn its sector or index membership. A
 *      symbol absent from that feed (a delisted company still filing, a
 *      fund-manager pseudo-symbol like MCBIM-FUNDS) cannot be placed, so
 *      it is dropped rather than guessed — but ONLY when one of these is
 *      actually on.
 *
 *   2. Filing type needs nothing but the title. It must never be gated
 *      on the lookup: doing so would make every non-Market-Watch filing
 *      vanish from every category tab, a regression a title-only tag has
 *      no reason to cause.
 *
 * Separated from the page component so both behaviours can be tested
 * directly, without depending on what PSX happened to file today.
 */

export function applyMarketFilters(
  rows: readonly CompanyAnnouncement[],
  filters: { sector: string; shariah: boolean },
  bySymbol: ReadonlyMap<string, StockQuote>,
): CompanyAnnouncement[] {
  // With neither on, the lookup is never consulted — a symbol missing
  // from Market Watch is irrelevant here.
  if (!filters.sector && !filters.shariah) return [...rows];
  return rows.filter((a) => {
    const quote = bySymbol.get(a.symbol);
    if (!quote) return false;
    if (filters.sector && quote.sector !== filters.sector) return false;
    if (filters.shariah && !(quote.isKmi30 || quote.isKmiAllShare)) return false;
    return true;
  });
}

/** How a set of filings splits across every filing type. */
export function countByCategory(
  rows: readonly CompanyAnnouncement[],
): Record<Category, number> {
  const counts = Object.fromEntries(
    CATEGORY_TABS.map((tab) => [tab.id, 0]),
  ) as Record<Category, number>;
  for (const a of rows) counts[categorize(a.title)]++;
  return counts;
}

/** Keeps only one filing type. Title-only — no lookup of any kind. */
export function applyCategory(
  rows: readonly CompanyAnnouncement[],
  category: Category | null,
): CompanyAnnouncement[] {
  if (!category) return [...rows];
  return rows.filter((a) => categorize(a.title) === category);
}
