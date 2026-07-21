/**
 * Full PSX index quote for the dedicated indices feed
 * (/api/market/indices-full), sourced from dps.psx.com.pk/indices.
 *
 * Deliberately has NO value/turnover field: PSX's public data portal
 * exposes no traded-value metric for an index anywhere, so rather than
 * carry a perpetually-null placeholder that implies "coming soon", the
 * field is omitted entirely — it is not a real PSX metric to surface.
 *
 * `volume` is DERIVED (sum of constituent volumes from the market-watch
 * table), not a first-class PSX index field — see the endpoint for the
 * derivation and its known all-share undercount.
 *
 * Kept in its own module (not the src/types barrel) so this milestone
 * adds no changes to existing files; the barrel re-export can follow in
 * the UI milestone that consumes it.
 */
export interface FullIndexQuote {
  /** PSX index code, e.g. "KSE100", "BKTI". */
  code: string;
  /** Human-readable official name, e.g. "Banking Tradable Index". */
  name: string;
  /** Current index level. */
  value: number;
  /** Session high / low. */
  high: number;
  low: number;
  /** Change from previous close, in index points. */
  changePoints: number;
  /** Change from previous close, as a percentage. */
  changePercent: number;
  direction: "up" | "down";
  /** Derived: summed constituent share volume (see endpoint notes). */
  volume: number;
}

/** Response for GET /api/market/indices-full. */
export interface FullIndicesResponse {
  indices: FullIndexQuote[];
  /** ISO time of the underlying PSX fetch. */
  asOf: string;
  /** Where the payload came from. */
  source: "psx" | "cache";
  /** True when serving the last known-good values during an outage. */
  stale?: boolean;
}
