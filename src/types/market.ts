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
  /**
   * Full company name from PSX's own symbol directory. Optional: the
   * directory is a second, independent fetch, and a symbol it does not
   * carry (or a directory outage) leaves this absent so the UI shows
   * the bare ticker — never a guessed or prettified name.
   */
  name?: string;
  /**
   * PSX-published sector NAME (e.g. "COMMERCIAL BANKS"). The
   * market-watch table itself carries only an unmapped 4-digit sector
   * code, so this comes from the same directory as `name` and is
   * optional for the same reasons.
   */
  sector?: string;
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
/**
 * Raw session breadth, in NUMBERS rather than the display strings the
 * `stats` array carries.
 *
 * `stats` exists to be printed; this exists to be computed with. They
 * are deliberately separate: the stats entries are pre-formatted
 * ("948.7M shares", "291") and several consumers render them verbatim,
 * so deriving arithmetic from them would mean parsing our own display
 * layer back into numbers.
 *
 * advancers/decliners/unchanged count EVERY quoted symbol. The two
 * volume sums do not: a symbol showing a price change on zero trades
 * contributes nothing to a volume-weighted read, so it is excluded
 * there and counted here. That asymmetry is the point — the counts say
 * how many moved, the volumes say how much conviction was behind it.
 */
export interface MarketBreadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  /** Sum of volume across advancing symbols (zero-volume excluded). */
  advancingVolume: number;
  /** Sum of volume across declining symbols (zero-volume excluded). */
  decliningVolume: number;
}

export interface MarketWatchResponse {
  quotes: StockQuote[];
  stats: MarketStat[];
  /*
   * OPTIONAL, and it has to stay optional. The handler keeps a warm
   * in-memory lastGood payload and the edge cache holds up to 30
   * minutes outside session hours, so for a while after any deploy
   * this field genuinely arrives undefined on real requests. Consumers
   * must treat its absence as "not known yet", never as zero.
   */
  breadth?: MarketBreadth;
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
