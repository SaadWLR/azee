/**
 * One PMEX commodity-FUTURES quote — a PMEX-listed futures contract on
 * an international commodity (crude oil, gold, wheat, …).
 *
 * These are deliberately NOT spot commodity prices. `commodity` names the
 * underlying, `contract` is the real PMEX futures symbol (e.g.
 * "CRUDE1-SE26"), and the price fields are that futures market's
 * bid/ask — not a spot rate. Everything downstream must frame these as
 * "{commodity} futures (PMEX)", never "the {commodity} price" — the same
 * factual-not-overstated discipline as the KMI-30 and global index
 * futures work. The type is named PmexCommodityQuote (not …PriceQuote)
 * and carries `contract` rather than a bare `price` so that framing
 * cannot drift.
 *
 * Scope note: PMEX also lists PHYSICAL, PKR-denominated, deliverable
 * contracts (Phy_Gold "TOLAGOLD", Phy_Agri "LGMRRICE"). Those are a
 * genuinely different product type — a different instrument, currency
 * and unit from these international futures — and are deliberately NOT
 * represented by this type. If they are ever added they need their own
 * type and their own distinct framing, never mixed into this table.
 */
export interface PmexCommodityQuote {
  /** The real PMEX futures contract symbol, e.g. "CRUDE1-SE26". */
  contract: string;
  /** The underlying commodity, e.g. "Crude Oil (WTI)", "Gold". */
  commodity: string;
  /** Display grouping: "Energy" | "Metals" | "Agriculture". */
  group: CommodityGroup;
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
   * Session high / low. PMEX reports 0 for these when it has not traded
   * a range in the session (verified live — e.g. thinly-traded Aluminum),
   * so they are null when genuinely unavailable rather than a fabricated
   * 0, matching the PSX "no traded-value" precedent.
   */
  high: number | null;
  low: number | null;
}

export type CommodityGroup = "Energy" | "Metals" | "Agriculture";

/** Response for GET /api/market/commodities. */
export interface PmexCommoditiesResponse {
  commodities: PmexCommodityQuote[];
  /**
   * Target commodities with no currently-active PMEX contract, by name.
   * Reported explicitly rather than silently dropped or zero-filled, so
   * the UI can say "not currently quoted" honestly.
   */
  unavailable: string[];
  /** ISO time of the freshest underlying PMEX quote (its `_datetime`). */
  asOf: string;
  source: "pmex" | "cache";
  stale?: boolean;
}
