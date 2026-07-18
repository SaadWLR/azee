import type { KnowledgeModule } from "../types/knowledge";

/**
 * The Knowledge Centre module registry — the single source of truth
 * for the landing grid, the hero's summary metadata, and the dynamic
 * module route. One typed array, not eight components.
 *
 * Chapter counts, levels, and time estimates are real structural
 * metadata. Chapter *content* is intentionally absent (`chapters`
 * undefined) until the content milestone; the module page shows an
 * honest coming-soon state meanwhile. Do not add chapter titles or
 * lesson text here until real content exists.
 */
export const KNOWLEDGE_MODULES: KnowledgeModule[] = [
  {
    slug: "stock-market-basics",
    title: "Stock Market Basics",
    level: "Beginner",
    chapterCount: 5,
    estimatedMinutes: 60,
  },
  {
    slug: "fundamental-analysis",
    title: "Fundamental Analysis",
    level: "Intermediate",
    chapterCount: 6,
    estimatedMinutes: 60,
  },
  {
    slug: "technical-analysis",
    title: "Technical Analysis",
    level: "Intermediate",
    chapterCount: 7,
    estimatedMinutes: 60,
  },
  {
    slug: "investment-strategies",
    title: "Investment Strategies",
    level: "Advanced",
    chapterCount: 8,
    estimatedMinutes: 60,
  },
  {
    slug: "commodities-market",
    title: "Commodities Market",
    level: "Intermediate",
    chapterCount: 5,
    estimatedMinutes: 60,
  },
  {
    slug: "currency-market",
    title: "Currency Market",
    level: "Intermediate",
    chapterCount: 6,
    estimatedMinutes: 60,
  },
  {
    slug: "mutual-funds",
    title: "Mutual Funds",
    level: "Beginner",
    chapterCount: 7,
    estimatedMinutes: 60,
  },
  {
    slug: "intraday-futures-trading",
    title: "Intraday & Futures Trading",
    level: "Advanced",
    chapterCount: 8,
    estimatedMinutes: 60,
  },
];

/** O(1)-ish lookup for the dynamic module route; undefined for bad slugs. */
export function getKnowledgeModule(
  slug: string | undefined,
): KnowledgeModule | undefined {
  return KNOWLEDGE_MODULES.find((m) => m.slug === slug);
}

/** Total learning time across all modules, in whole hours (for the hero). */
export const KNOWLEDGE_TOTAL_HOURS = Math.round(
  KNOWLEDGE_MODULES.reduce((sum, m) => sum + m.estimatedMinutes, 0) / 60,
);
