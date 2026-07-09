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
}

/** A labelled session statistic (volume, value, sector moves…). */
export interface MarketStat {
  label: string;
  value: string;
  direction?: Direction;
}

/** Everything the market snapshot panel renders in one payload. */
export interface MarketSnapshot {
  index: MarketIndex;
  stats: MarketStat[];
  status: MarketStatus;
  timestamp: string;
}
