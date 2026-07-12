/**
 * A live, attributed headline from a real publisher's RSS feed.
 * `summary`, when present, is the publisher's own lede text verbatim
 * — never written by us.
 */
export interface NewsFeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

/** Live news payload from /api/news/latest. */
export interface NewsFeedResponse {
  items: NewsFeedItem[];
  /** ISO time of the underlying feed fetch. */
  asOf: string;
  /** Where the payload came from. */
  source: "live" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}
