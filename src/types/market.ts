export type Direction = "up" | "down";

export type MarketStatus = "OPEN" | "CLOSED";

/** A benchmark index quote, e.g. the KSE-100. */
export interface MarketIndex {
  name: string;
  value: number;
  changePercent: number;
  changePoints: number;
  direction: Direction;
}

/** A single listed-symbol quote for tickers and watchlists. */
export interface StockQuote {
  symbol: string;
  price: number;
  changePercent: number;
  /** Change in currency points (live market-watch data only). */
  changePoints?: number;
  /** Shares traded this session (live market-watch data only). */
  volume?: number;
}

/** A labelled session statistic (volume, value, sector moves…). */
export interface MarketStat {
  label: string;
  value: string;
  direction?: Direction;
}

/** Full market-watch payload: per-symbol quotes plus session stats. */
export interface MarketWatchResponse {
  quotes: StockQuote[];
  stats: MarketStat[];
  /** ISO time of the underlying PSX fetch. */
  asOf: string;
  /** Where the payload came from. */
  source: "psx" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}

/** Everything the market snapshot panel renders in one payload. */
export interface MarketSnapshot {
  index: MarketIndex;
  stats: MarketStat[];
  status: MarketStatus;
  timestamp: string;
  /** ISO time of the underlying PSX tick (live data only). */
  asOf?: string;
  /** Where the payload came from. */
  source?: "psx" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}
