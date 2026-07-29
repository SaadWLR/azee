/**
 * One PSX-listed Exchange Traded Fund quote.
 *
 * ETFs trade on the Pakistan Stock Exchange like any other listed
 * instrument — they have a live intraday bid/ask-driven price, a
 * session high/low, and traded volume. That is what makes them
 * different from MUTUAL FUNDS, which are priced once daily at NAV and
 * do not trade on the exchange at all. Mutual funds are deliberately
 * not represented by this type; they need their own data source and
 * their own framing, and mixing the two would imply a live exchange
 * price for something that has never had one.
 */
export interface EtfQuote {
  /** PSX ticker, e.g. "MZNPETF". */
  symbol: string;
  /** Fund name as PSX publishes it, e.g. "Meezan Pakistan ETF". */
  name: string;
  /** Current traded price. */
  price: number;
  /**
   * Last Day Closing Price — the reference the day's change is measured
   * from. Surfaced because ETF investors track it directly; the market
   * -watch endpoint parses it and drops it.
   */
  ldcp: number;
  /** Session high / low. */
  high: number;
  low: number;
  /** Change from LDCP, in rupees. */
  changePoints: number;
  changePercent: number;
  direction: "up" | "down";
  volume: number;
}

/** Response for GET /api/market/etfs. */
export interface EtfsResponse {
  etfs: EtfQuote[];
  /** ISO time the PSX table was read. */
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
