import { mockResponse } from "../lib/apiClient";
import type { ResearchReport } from "../types";

/*
 * Editorial fixtures shaped like a research-portal CMS feed. Replace
 * each mockResponse with apiGet against the research API — payload
 * shapes are already aligned.
 */

const RESEARCH_REPORTS: ResearchReport[] = [
  {
    category: "Weekly Market Outlook",
    title:
      "KSE-100 consolidates near record territory as FY27 budget flows settle",
    excerpt:
      "Index heavyweights absorbed post-budget positioning while volumes held above the quarterly average. We look at rollover week dynamics, foreign participation, and the sectors most sensitive to the upcoming monetary policy decision.",
    date: "Jul 6, 2026",
    readMinutes: 8,
    featured: true,
  },
  {
    category: "Sector Analysis",
    title: "Commercial banks: margins versus the easing cycle",
    excerpt:
      "Spreads compress as policy rates step down; deposit mix and fee income now drive the divergence across the sector.",
    date: "Jul 3, 2026",
    readMinutes: 12,
  },
  {
    category: "Company Reports",
    title: "OGDC: production outlook and the dividend question",
    excerpt:
      "Field-level decline rates, development spend, and what circular-debt settlements mean for payout capacity.",
    date: "Jul 1, 2026",
    readMinutes: 15,
  },
  {
    category: "Sector Analysis",
    title: "Cement dispatches firm on northern demand; pricing holds",
    excerpt:
      "Utilisation improves into the construction season while coal costs stay contained — margins hold their ground.",
    date: "Jun 27, 2026",
    readMinutes: 10,
  },
  {
    category: "Market Commentary",
    title: "Foreign flows return to index heavyweights",
    excerpt:
      "A third consecutive week of net foreign buying, concentrated in banks and E&Ps — what the tape says about positioning.",
    date: "Jun 25, 2026",
    readMinutes: 6,
  },
];

/** Short titles shown in the market snapshot's research list. */
const RECENT_RESEARCH_TITLES = [
  "Weekly Market Outlook",
  "Banking Sector Update",
  "Cement Industry Review",
];

/** Full publications for the research section. */
export async function getResearchReports(): Promise<ResearchReport[]> {
  // return apiGet<ResearchReport[]>("/research/reports");
  return mockResponse(RESEARCH_REPORTS);
}

/** Compact list of the latest publication titles. */
export async function getRecentResearchTitles(): Promise<string[]> {
  // return apiGet<string[]>("/research/recent");
  return mockResponse(RECENT_RESEARCH_TITLES);
}
