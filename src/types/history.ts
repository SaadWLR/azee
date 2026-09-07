/**
 * PSX's end-of-day archive for the KSE-100.
 *
 * Source: dps.psx.com.pk/timeseries/eod/KSE100, which returns
 * `{ status, message, data: [[epochSeconds, close, volume, x], …] }`
 * newest-first, currently ~1,240 sessions reaching back to Aug 2021.
 */
export interface EodPoint {
  /** ISO date (YYYY-MM-DD) of the session. */
  date: string;
  /** Closing index level. */
  close: number;
  /** Shares traded across the index's constituents. */
  volume: number;
  /**
   * PSX's FOURTH column, and emphatically NOT traded value.
   *
   * The obvious reading of a column called "value" in a market feed is
   * money changing hands, and this is not that. Measured across all
   * 1,240 sessions it correlates with the CLOSE at 0.9998, spans the
   * same range the close does (38,347–189,789 against 38,342–189,167),
   * and sits within 3% of that session's close on 98.2% of days —
   * sometimes above it, sometimes below. Traded value would run to
   * billions of rupees and would track volume, which it does not
   * (correlation 0.65).
   *
   * So it is an index LEVEL of some kind — an intraday average or
   * similar. PSX does not document which, and this file will not guess
   * one: the name says what it demonstrably is and nothing more.
   *
   * Nothing computes with it today. It is carried because it is real
   * data from the feed, and named this way so that the next person to
   * reach for a "traded value" does not find a plausible number here
   * and use it.
   */
  indexAverage: number;
}

/** One recorded session of live-computed market breadth. */
export interface BreadthPoint {
  /** ISO date (YYYY-MM-DD) the reading was taken. */
  date: string;
  /** That session's Arms Index (TRIN). */
  trin: number;
}

/** One recorded session of PSX's derivatives-to-ready-market value ratio. */
export interface DerivativesPoint {
  /** ISO date (YYYY-MM-DD) the reading was taken. */
  date: string;
  /**
   * (Deliverable Futures + Cash Settled Futures + Stock Index Futures
   * value) / Regular market value, that session, from PSX's own
   * homepage "Today's Summary" panel. NOT from PSX's EOD archive —
   * that publishes no such breakdown, which is why this is recorded
   * daily rather than fetched on demand.
   */
  ratio: number;
}

/** One recorded session of the price-strength breadth measure. */
export interface PriceStrengthPoint {
  /** ISO date (YYYY-MM-DD) the reading was taken. */
  date: string;
  /**
   * (stocks trading above their ~1-year-ago price − stocks trading
   * below) / stocks compared, that session. NOT "share near a 52-week
   * high/low" — PSX publishes no archive deep enough to track a
   * rolling 52-week extreme for ~490 symbols affordably, so this
   * measures something PSX-cheap instead: whether the market is
   * broadly up or down over the past year, using one reference price
   * per stock rather than a full price history. See
   * api/cron/record-breadth.ts for how the reference is kept roughly
   * current.
   */
  share: number;
}

/**
 * One recorded session of gold and USD/PKR, for Safe Haven Demand.
 *
 * NOT from PSX. Both legs come from the same public currency CDN the
 * gold estimate on /forex already uses, which publishes dated
 * snapshots as well as today's — so unlike breadth, this history could
 * be backfilled in one pass rather than accumulated a day at a time.
 *
 * That archive is shallower than it looks: it begins around
 * 2024-03-02, roughly 650 trading sessions back. Enough for the
 * 500-session ranking window plus the ten sessions a two-week return
 * consumes, but with little to spare — which is why the recorder
 * backfills every PSX session it can reach rather than a round number
 * of days.
 */
export interface GoldPoint {
  /** ISO date (YYYY-MM-DD) the reading was taken. */
  date: string;
  /** Spot gold, USD per troy ounce, as of that date. */
  xauUsd: number;
  /** USD/PKR mid rate, as of that date. */
  usdPkr: number;
}

export interface KseHistoryResponse {
  /** Full available EOD series, oldest first. */
  points: EodPoint[];
  /**
   * Breadth readings recorded by the daily cron, oldest first.
   *
   * NOT from PSX — PSX publishes no breadth archive, which is the
   * whole reason this has to be accumulated a day at a time. Served
   * from the same endpoint as `points` purely to avoid spending a
   * Vercel function on a second history route; empty until the
   * recorder has run, and absent entirely if the KV store is not
   * provisioned yet.
   */
  breadthHistory?: BreadthPoint[];
  /**
   * Gold and USD/PKR readings recorded by the daily cron, oldest
   * first.
   *
   * NOT from PSX either, and served from this endpoint for the same
   * reason breadthHistory is: a second history route would spend a
   * Vercel function this project cannot spare. Empty until the
   * recorder has run, and absent entirely if the KV store is not
   * provisioned yet.
   */
  goldHistory?: GoldPoint[];
  /**
   * Derivatives-activity ratios recorded by the daily cron, oldest
   * first.
   *
   * NOT from PSX's EOD archive — PSX's homepage publishes today's
   * futures-vs-ready-market breakdown and nothing historical, which is
   * why this is accumulated a day at a time exactly as breadthHistory
   * is. Served from this endpoint for the same reason breadthHistory
   * and goldHistory are: a second history route would spend a Vercel
   * function this project cannot spare. Empty until the recorder has
   * run, and absent entirely if the KV store is not provisioned yet.
   */
  derivativesHistory?: DerivativesPoint[];
  /**
   * Price-strength readings recorded by the daily cron, oldest first.
   *
   * NOT from a PSX archive — PSX publishes no rolling 52-week
   * high/low history for its ~490 listed stocks, which is why this
   * measures something PSX-cheap instead: the share of stocks trading
   * above vs below their price from roughly a year ago. Served from
   * this endpoint for the same reason the other recorded histories
   * are: a second history route would spend a Vercel function this
   * project cannot spare. Empty until the recorder has run, and
   * absent entirely if the KV store is not provisioned yet.
   */
  priceStrengthHistory?: PriceStrengthPoint[];
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}

/**
 * One PSX index's price archive, and nothing else.
 *
 * Deliberately NOT KseHistoryResponse with the symbol bolted on. That
 * type carries breadthHistory and goldHistory, which exist to feed the
 * Fear and Optimism Index and are meaningless for, say, the Bank
 * Index — a response that always shipped them as undefined would
 * invite a reader to wonder whether BKTI's breadth had simply not been
 * recorded yet, when in truth no such thing is defined for it.
 *
 * `points` reuses EodPoint unchanged. Despite living in a file named
 * around the KSE-100's history, nothing in that shape is specific to
 * the KSE-100 — it is a date, a close, a volume and the fourth column
 * PSX serves for every index alike.
 */
export interface SymbolHistoryResponse {
  /** The PSX index/symbol code this history is for. */
  symbol: string;
  /** Full available EOD series, oldest first. */
  points: EodPoint[];
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
