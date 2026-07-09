/**
 * PSX market data — static placeholders shaped like a market-data feed.
 *
 * Values reflect actual early-July-2026 Pakistan Stock Exchange sessions
 * (KSE-100 close of Jul 6, 2026). Every consumer reads from this module
 * only, so wiring a live source (e.g. the PSX data portal at
 * dps.psx.com.pk or a broker market-data service) means replacing these
 * constants with fetched values — no UI changes required.
 */

export type Direction = "up" | "down";

export interface IndexSnapshot {
  name: string;
  value: number;
  changePercent: number;
  changePoints: number;
  direction: Direction;
}

export interface MarketStat {
  label: string;
  value: string;
  direction?: Direction;
}

export interface TickerQuote {
  symbol: string;
  price: number;
  changePercent: number;
}

export const KSE_100: IndexSnapshot = {
  name: "KSE-100 Index",
  value: 187454.64,
  changePercent: 1.12,
  changePoints: 2082.49,
  direction: "up",
};

export const MARKET_STATS: MarketStat[] = [
  { label: "Market Volume", value: "703.7M shares" },
  { label: "Market Value", value: "PKR 38.8B" },
  { label: "Top Gaining Sector", value: "Commercial Banks", direction: "up" },
  { label: "Top Loser", value: "Textile Composite", direction: "down" },
  { label: "IPOs", value: "2 Upcoming" },
];

export const RECENT_RESEARCH: string[] = [
  "Weekly Market Outlook",
  "Banking Sector Update",
  "Cement Industry Review",
];

export const MARKET_TIMESTAMP = "Karachi · PKT";

export interface ResearchArticle {
  category:
    | "Weekly Market Outlook"
    | "Company Reports"
    | "Sector Analysis"
    | "Market Commentary";
  title: string;
  excerpt: string;
  date: string;
  readMinutes: number;
  featured?: boolean;
}

/**
 * Editorial placeholders for the research section, shaped like a CMS
 * feed — swap in the research portal's API without touching the UI.
 */
export const RESEARCH_ARTICLES: ResearchArticle[] = [
  {
    category: "Weekly Market Outlook",
    title: "KSE-100 consolidates near record territory as FY27 budget flows settle",
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

/** Liquid PSX main-board symbols for the ticker tape. */
export const TICKER_QUOTES: TickerQuote[] = [
  { symbol: "OGDC", price: 226.4, changePercent: 1.84 },
  { symbol: "HBL", price: 142.75, changePercent: 2.1 },
  { symbol: "LUCK", price: 1148.0, changePercent: 0.92 },
  { symbol: "ENGRO", price: 318.5, changePercent: -0.41 },
  { symbol: "UBL", price: 372.2, changePercent: 1.47 },
  { symbol: "PSO", price: 384.1, changePercent: -1.18 },
  { symbol: "MEBL", price: 342.8, changePercent: 0.73 },
  { symbol: "FFC", price: 438.25, changePercent: 1.06 },
  { symbol: "SYS", price: 1924.0, changePercent: 2.38 },
  { symbol: "MARI", price: 692.3, changePercent: -0.64 },
  { symbol: "TRG", price: 64.85, changePercent: 3.21 },
  { symbol: "POL", price: 598.4, changePercent: 0.35 },
];
