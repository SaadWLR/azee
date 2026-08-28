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
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
