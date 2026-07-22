/**
 * A single constituent company of a PSX index, parsed from the
 * dps.psx.com.pk/indices/<CODE> page. Every field is real PSX data;
 * the page is the only public source that carries constituent company
 * NAMES and per-constituent index WEIGHTS.
 */
export interface IndexConstituent {
  symbol: string;
  /** Full company name, e.g. "Mari Energies Limited". */
  name: string;
  /** Last day's closing price. */
  ldcp: number;
  current: number;
  change: number;
  changePercent: number;
  /** The constituent's weight in the index, as a percentage. */
  indexWeight: number;
  /** The constituent's contribution to the index level, in points. */
  indexPoints: number;
  volume: number;
  /** Free-float shares (raw). */
  freeFloat: number;
  /** Market capitalisation (raw, PKR). */
  marketCap: number;
}

/** Response for GET /api/market/index-constituents?code=<CODE>. */
export interface IndexConstituentsResponse {
  code: string;
  count: number;
  constituents: IndexConstituent[];
  /** ISO time of the underlying PSX fetch. */
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
