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
  /**
   * Constituent of PSX's KMI-30 Islamic index. A statement of official
   * index membership (per the published KMI methodology), not a
   * religious ruling. Absent/false means "not a listed KMI-30 member",
   * never a fabricated claim. KMI-30 is a subset of KMI All-Share.
   */
  isKmi30?: boolean;
  /** Constituent of PSX's KMI All-Share Islamic index (see isKmi30). */
  isKmiAllShare?: boolean;
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

/**
 * One benchmark index in the multi-index feed (/api/market/indices).
 * Carries MarketIndex's fields plus the PSX timeseries code and the
 * index's own tick time. Every value is real PSX data — an index that
 * fails to fetch is omitted from the response, never fabricated.
 */
export interface MarketIndexQuote extends MarketIndex {
  /** PSX timeseries code, e.g. "KSE100", "ALLSHR", "KMIALLSHR". */
  code: string;
  /** ISO time of this index's latest underlying PSX tick. */
  asOf: string;
}

/**
 * Live values for PSX's main benchmark indices (KSE-100, KSE-30, KSE
 * All Share, KMI-30, KMI All Share). Only indices that fetched
 * successfully appear in `indices`; session `status` and `asOf` reflect
 * the freshest tick across the returned set.
 */
export interface MarketIndicesResponse {
  indices: MarketIndexQuote[];
  status: MarketStatus;
  /** ISO time of the freshest underlying PSX tick in the set. */
  asOf: string;
  /** Where the payload came from. */
  source: "psx" | "cache";
  /** True when serving the last known-good values during an outage. */
  stale?: boolean;
}

/**
 * The index snapshot payload. Session stats are not part of this
 * shape — they come live from MarketWatchResponse; the panel composes
 * the two so no stat can ever be fabricated here.
 */
export interface MarketSnapshot {
  index: MarketIndex;
  status: MarketStatus;
  timestamp: string;
  /** ISO time of the underlying PSX tick (live data only). */
  asOf?: string;
  /** Where the payload came from. */
  source?: "psx" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}
