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
  /**
   * The publisher's own article image, taken verbatim from the RSS
   * item (Business Recorder's media:content, The Express Tribune's
   * item-scoped <image>). Optional: absent when a feed item carries no
   * image. Never a fabricated or placeholder URL — if extraction
   * yields nothing, this stays undefined.
   */
  imageUrl?: string;
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
