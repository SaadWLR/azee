/** A market news headline from an external or in-house feed. */
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  url?: string;
}
