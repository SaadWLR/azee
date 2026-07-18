/**
 * Knowledge Centre — typed content structure.
 *
 * Deliberately split into structural metadata (known now: counts,
 * levels, time estimates) and content (chapter titles/bodies), which
 * is NOT written yet. The content fields are optional so a future
 * content drop is purely additive — filling in `chapters` on a module
 * — rather than a schema change. Nothing here fabricates lesson text.
 */

export type KnowledgeLevel = "Beginner" | "Intermediate" | "Advanced";

/**
 * A single chapter. Every field is optional: only the *count* of
 * chapters per module is known today (see `KnowledgeModule.chapterCount`).
 * Titles and bodies arrive with the real content and stay undefined
 * until then — never invented.
 */
export interface KnowledgeChapter {
  title?: string;
  summary?: string;
  body?: string;
}

export interface KnowledgeModule {
  /** URL segment, e.g. "stock-market-basics". */
  slug: string;
  title: string;
  level: KnowledgeLevel;
  /** Real structural fact: how many chapters this module will contain. */
  chapterCount: number;
  /** Real structural fact: approximate total learning time, in minutes. */
  estimatedMinutes: number;
  /**
   * Populated in a future content drop. Undefined/empty for now — the
   * module page renders an honest "coming soon" state while this is
   * absent, and never renders invented chapter content.
   */
  chapters?: KnowledgeChapter[];
}
