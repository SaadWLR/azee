/**
 * One PMEX index-FUTURES quote — a PMEX-listed futures contract that
 * references a global equity benchmark (e.g. the S&P 500).
 *
 * These are deliberately NOT spot index levels. `benchmark` names the
 * underlying benchmark, `contract` is the real PMEX futures symbol
 * (e.g. "SP500-SE26"), and the price fields are the futures market's
 * bid/ask — not the index value. Everything downstream must frame these
 * as "{benchmark} futures (PMEX)", never "the {benchmark} index" — the
 * same factual-not-overstated discipline as the KMI-30 feature. The type
 * is named GlobalFuturesQuote (not …IndexQuote) so that framing can't
 * drift.
 */
export interface GlobalFuturesQuote {
  /** The real PMEX futures contract symbol, e.g. "SP500-SE26". */
  contract: string;
  /** The global benchmark the contract references, e.g. "S&P 500". */
  benchmark: string;
  bid: number;
  ask: number;
  open: number;
  /** PMEX-reported close — the reference the Change is measured from. */
  previousClose: number;
  /** Change from previousClose, in contract points. */
  changePoints: number;
  changePercent: number;
  direction: "up" | "down";
  volume: number;
  /**
   * Session high / low. PMEX reports 0 for these outside a live session
   * (verified), so they are null when genuinely unavailable — never a
   * fabricated 0, matching the PSX "no traded-value" precedent.
   */
  high: number | null;
  low: number | null;
}

/** Response for GET /api/market/global-futures. */
export interface GlobalFuturesResponse {
  futures: GlobalFuturesQuote[];
  /** ISO time of the underlying PMEX quote (its `_datetime`). */
  asOf: string;
  source: "pmex" | "cache";
  stale?: boolean;
}
