import type { EtfQuote } from "./etfs";
import type {
  MarketBreadth,
  MarketIndexQuote,
  MarketStat,
  StockQuote,
} from "./market";

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
  /**
   * PSX's benchmark indices (KSE100, KSE30, ALLSHR, KMI30, KMIALLSHR —
   * the list in api/market/indices.ts), each with its own tick time in
   * asOf. Optional and additive to schema 1: a message without it leaves
   * the stored indices exactly as they were. Served by
   * /api/market/indices; a benchmark absent here is reported in that
   * response's `missing`, never invented.
   */
  indices?: MarketIndexQuote[];
  /**
   * PSX-listed ETFs. Optional and additive, like `indices`. Served by
   * /api/market/etfs. Every field is required, as on the portal path.
   */
  etfs?: EtfQuote[];
}

/**
 * What the site stores for the latest accepted snapshot. The indices and
 * ETFs live under their own keys (below), so a market-watch read never
 * carries them and a message without them never touches them.
 */
export interface StoredMarketWatchFeed
  extends Omit<MarketWatchFeedEnvelope, "indices" | "etfs"> {
  /** Site clock at acceptance. */
  receivedAt: string;
}

/** Fields every stored side snapshot copies from its envelope. */
interface StoredFeedSection {
  /** The envelope's asOf (PSX's own timestamp for the message). */
  asOf: string;
  /** The envelope's marketStatus, absent when the message had none. */
  marketStatus?: MarketWatchFeedEnvelope["marketStatus"];
  /** Site clock at acceptance. */
  receivedAt: string;
}

/** Stored under "feed:indices" by the last message that carried indices. */
export interface StoredIndicesFeed extends StoredFeedSection {
  indices: MarketIndexQuote[];
}

/** Stored under "feed:etfs" by the last message that carried ETFs. */
export interface StoredEtfsFeed extends StoredFeedSection {
  etfs: EtfQuote[];
}
