import type { MarketBreadth, MarketStat, StockQuote } from "./market";

/**
 * WIRE FORMAT v1 — the office feed agent → site POST.
 *
 * AZEE receives PSX's live feed from a broadcaster in its own office. A
 * small agent there reads the broadcaster's logs, normalizes them into
 * this envelope and POSTs it to /api/market/watch (api/market/psx-watch.ts,
 * view=watch) with `Authorization: Bearer $FEED_INGEST_SECRET`.
 *
 * The quote, breadth and stat shapes are the site's existing ones, on
 * purpose: what the agent sends is what the site already serves, so a
 * feed snapshot needs no translation layer and no new UI.
 *
 * The receiver is strict and all-or-nothing: one bad field rejects the
 * whole snapshot with a 400 and a reason code, and nothing is stored.
 * An unpublished optional field (open, dayHigh, …) must be OMITTED,
 * never sent as 0 — the same rule the portal parser applies, because a
 * 0 renders as a real price of 0.00.
 */
export interface MarketWatchFeedEnvelope {
  schema: 1;
  kind: "market-watch";
  /**
   * PSX's OWN timestamp for this snapshot, as carried in the feed —
   * never the agent's clock. ISO-8601 with an explicit offset
   * ("2026-10-15T14:32:05+05:00" or "…Z"). Snapshots are ordered by it.
   */
  asOf: string;
  /** When the agent sent this (agent clock). Diagnostic only. */
  sentAt: string;
  /**
   * Session state as the feed reports it. Optional because where the
   * broadcaster's logs carry it is not yet known; absent or "unknown"
   * means the site never labels the data fresh or stale.
   */
  marketStatus?: "open" | "closed" | "unknown";
  /**
   * The agent's statement that this is a full board read, not a partial
   * one. Only `true` is accepted; `false` lets an agent that knows its
   * read was cut short say so rather than guess.
   */
  complete: boolean;
  quotes: StockQuote[];
  breadth?: MarketBreadth;
  stats?: MarketStat[];
}

/** What the site stores for the latest accepted snapshot. */
export interface StoredMarketWatchFeed extends MarketWatchFeedEnvelope {
  /** Site clock at acceptance. */
  receivedAt: string;
}
