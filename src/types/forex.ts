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

/**
 * A COMPUTED estimate of the local Karachi Sarafa gold rate.
 *
 * This is not a quote. Nobody publishes this number to us: it is
 * arithmetic on an international gold price and a currency rate, plus
 * an assumed local premium — two layers of approximation stacked. The
 * real Sarafa Bazaar rate is set by APSGJA once daily and is not
 * obtainable from any source we were able to verify.
 *
 * It is therefore expressed as a RANGE, not a figure. The local
 * premium was measured at 1.18–1.85% over spot across two separate
 * days and is explicitly not established as stable, so publishing a
 * single number would assert a precision the data does not support.
 * The type has no single `value` field on purpose.
 */
export interface GoldEstimate {
  /** Low end of the estimated range, PKR per tola. */
  lowPkrPerTola: number;
  /** High end of the estimated range, PKR per tola. */
  highPkrPerTola: number;
  /** The zero-premium arithmetic result, before any local premium. */
  basePkrPerTola: number;
  /** International spot gold used, USD per troy ounce. */
  spotUsdPerOz: number;
  /** The premium band applied, as percentages. */
  premiumLowPct: number;
  premiumHighPct: number;
  /** Source's own date for the spot price, passed through verbatim. */
  spotAsOf: string;
}

/** Response for GET /api/market/forex. */
export interface ForexResponse {
  rates: ForexRate[];
  /**
   * Absent when the gold input could not be fetched or validated —
   * the currency rates are unaffected, and the page simply omits the
   * estimate rather than showing a stale or half-derived figure.
   */
  gold?: GoldEstimate;
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
