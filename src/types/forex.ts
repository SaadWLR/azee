/**
 * One PKR cross rate — a MID-MARKET reference rate.
 *
 * This is deliberately NOT the Pakistani open-market ("money changer")
 * rate, and not an interbank dealing rate either. It is the mid-market
 * reference — the same class of number Google Finance, Xe and Wise
 * publish — and it carries NO bid/ask spread, because the source does
 * not provide one. A visitor changing money at a counter will be quoted
 * something different, typically a rupee or so away on USD.
 *
 * Everything downstream must frame these as "mid-market reference
 * rates", never as "the rate you'll get" — the same
 * factual-not-overstated discipline as the PMEX futures-vs-spot work.
 * There is no `bid`/`ask`/`buy`/`sell` field here on purpose: the shape
 * of the type should make an inaccurate presentation awkward to write.
 */
export interface ForexRate {
  /** ISO code of the foreign currency, e.g. "GBP". */
  code: string;
  /** Display name, e.g. "British Pound". */
  name: string;
  /** How many PKR one unit of `code` buys, at the mid-market rate. */
  pkrPerUnit: number;
}

/** Response for GET /api/market/forex. */
export interface ForexResponse {
  rates: ForexRate[];
  /**
   * The SOURCE's own last-update time, passed through verbatim — never
   * the time we fetched, and never regenerated. The source publishes
   * once daily and is honest about it; echoing our own request time
   * here would manufacture a freshness the data does not have, which is
   * precisely why several other candidate sources were rejected.
   */
  sourceUpdatedAt: string;
  /** The source's own declared next update time, likewise verbatim. */
  sourceNextUpdateAt: string | null;
  /** Attribution required by the open endpoint's terms. */
  attribution: string;
  source: "er-api" | "cache";
  stale?: boolean;
}
