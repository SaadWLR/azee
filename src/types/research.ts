export type ResearchCategory =
  | "Weekly Market Outlook"
  | "Company Reports"
  | "Sector Analysis"
  | "Market Commentary";

/** An editorial research publication from the research desk. */
export interface ResearchReport {
  category: ResearchCategory;
  title: string;
  excerpt: string;
  date: string;
  readMinutes: number;
  featured?: boolean;
}
