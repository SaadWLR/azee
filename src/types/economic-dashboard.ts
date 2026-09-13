/**
 * Response contract for GET /api/economic/dashboard — Pakistan's headline
 * macro indicators, read by a daily cron from SBP EasyData
 * (easydata.sbp.org.pk) and served from KV.
 *
 * Nothing here is estimated or back-filled. Every figure is one SBP
 * EasyData publishes, with exactly one exception that says so in its own
 * shape: the reserves `total`, which SBP defines but no longer populates,
 * is summed from its published components and carries `computed: true`.
 *
 * TWO DIFFERENT KINDS OF "OLD", kept apart on purpose:
 *  - `asOf` is how current the FIGURE is: the end of the period SBP's
 *    number describes. GDP's is months behind CPI's because that is how
 *    Pakistan's statistics are released, not because anything failed.
 *    Each indicator carries its own, never one blanket timestamp.
 *  - `status: "stale"` is about OUR FETCH: the last daily run could not
 *    read that indicator, so the previous reading is being carried
 *    forward, with `staleSince` saying since when.
 *
 * Kept in its own module (not the src/types barrel) so this milestone
 * adds no changes to existing files; the barrel re-export can follow in
 * the UI milestone that consumes it.
 */

/** How often SBP publishes the indicator's underlying series. */
export type IndicatorFrequency =
  /** Only when it changes — the policy rate. */
  | "as-needed"
  | "monthly"
  | "quarterly"
  /** Pakistan's fiscal year, July to June. */
  | "fiscal-year";

/** Where an indicator's figures were read, so each one can be traced back. */
export interface IndicatorSource {
  /** The SBP EasyData page fetched. */
  url: string;
  /** Every EasyData series key the values came from. */
  seriesKeys: string[];
}

/** One successfully read set of figures for an indicator. */
export interface IndicatorReading<T> {
  /**
   * SBP's own label for the period the figures describe, verbatim:
   * "Aug-2026", "Mar-2026" (quarter ending March), "2026" (fiscal year
   * ending June 2026) or "28-Apr-2026" (a dated observation).
   */
  periodLabel: string;
  /** ISO date that period ends on (or the observation's own date), e.g. "2026-08-31". */
  asOf: string;
  frequency: IndicatorFrequency;
  values: T;
  source: IndicatorSource;
  /** ISO time these figures were fetched from SBP. */
  fetchedAt: string;
}

/**
 * An indicator as stored and served.
 *
 * - `fresh`: read successfully on the most recent run.
 * - `stale`: the most recent run failed for this indicator; the last good
 *   reading is carried forward unchanged (its own `fetchedAt` included).
 * - `unavailable`: never read successfully yet — no figures exist to show.
 */
export type Indicator<T> =
  | ({ status: "fresh" } & IndicatorReading<T>)
  | ({
      status: "stale";
      /** ISO time of the first failed run in the current failure streak. */
      staleSince: string;
      /** ISO time of the most recent failed attempt. */
      lastAttemptAt: string;
      /** Why the most recent attempt failed. */
      lastError: string;
    } & IndicatorReading<T>)
  | {
      status: "unavailable";
      lastAttemptAt: string;
      lastError: string;
    };

/* ── Per-indicator values ─────────────────────────────────────────── */

export interface PolicyRateValues {
  /** SBP Policy (Target) Rate, percent. */
  ratePercent: number;
  /**
   * The date SBP's policy-rate series records for its most recent
   * change — the dashboard's "date of last policy rate change". The
   * series only records changes, so a Monetary Policy Committee meeting
   * that holds the rate does not move this date; it is deliberately not
   * presented as "date of last MPC decision", which EasyData does not
   * publish. Same value as the indicator's `asOf`.
   */
  lastChangeDate: string;
}

export interface InflationPair {
  /** Year-on-year change, percent. */
  yoyPercent: number;
  /** Month-on-month change, percent. */
  momPercent: number;
}

export interface CpiValues {
  /** National CPI (base 2015-16). */
  headline: InflationPair;
  /**
   * Core inflation as SBP measures it: non-food non-energy (NFNE), which
   * EasyData publishes separately for urban and rural CPI — there is no
   * national core series.
   */
  core: {
    measure: "NFNE";
    urban: InflationPair;
    rural: InflationPair;
  };
}

export interface GdpGrowthValues {
  /** Real GDP growth, percent (Pakistan Bureau of Statistics, via SBP). */
  growthPercent: number;
}

/** A figure this pipeline calculated rather than read — never presented as SBP-published. */
export interface ComputedFigure {
  millionUsd: number;
  computed: true;
  /** How it was calculated, in words. */
  formula: string;
}

export interface FxReservesValues {
  /** Net reserves held by SBP, million USD. */
  sbpNetMillionUsd: number;
  /** Net reserves held by commercial banks, million USD. */
  banksNetMillionUsd: number;
  /**
   * Total liquid foreign exchange reserves. SBP's own series for this is
   * null on EasyData, so it is COMPUTED here from SBP's published
   * definition of it (net SBP + net banks) — see `formula`.
   */
  total: ComputedFigure;
}

export interface ExternalDebtValues {
  /** SBP's "Total External Debt and Liabilities", million USD. */
  totalMillionUsd: number;
}

/**
 * External debt servicing, as the three subtotals SBP itself publishes.
 *
 * Deliberately NO total field — not null, absent. SBP publishes no grand
 * total, and the subtotals don't add up to one confidently: on the
 * figures checked when this was written, the short-term principal
 * subtotal left out scheduled banks' borrowing (listed beside it, gross,
 * with its net flows separately). A sum of these three would look
 * authoritative without being SBP's number.
 */
export interface DebtServicingValues {
  /** "Total Long Term Principal payment", million USD. */
  longTermPrincipalMillionUsd: number;
  /** "Short Term Debt Servicing Principal payment", million USD. */
  shortTermPrincipalMillionUsd: number;
  /** "Total Interest Payment", million USD. */
  interestMillionUsd: number;
}

export interface TradeValues {
  /** Exports of goods, FOB, million USD. */
  exportsMillionUsd: number;
  /** Imports of goods, FOB, million USD. */
  importsMillionUsd: number;
  /** SBP's published balance on trade in goods, million USD (negative = deficit). */
  balanceMillionUsd: number;
  /** Goods trade as recorded in the balance of payments (BPM6), not customs data. */
  basis: "balance-of-payments-goods";
}

export interface RemittancesValues {
  /** Total inflow of workers' remittances, million USD. */
  inflowMillionUsd: number;
}

export interface EconomicIndicators {
  policyRate: Indicator<PolicyRateValues>;
  cpi: Indicator<CpiValues>;
  gdpAnnual: Indicator<GdpGrowthValues>;
  gdpQuarterly: Indicator<GdpGrowthValues>;
  fxReserves: Indicator<FxReservesValues>;
  externalDebt: Indicator<ExternalDebtValues>;
  debtServicing: Indicator<DebtServicingValues>;
  trade: Indicator<TradeValues>;
  remittances: Indicator<RemittancesValues>;
}

/* ── Responses ────────────────────────────────────────────────────── */

/** The stored snapshot, served as-is once the first daily run has written it. */
export interface EconomicDashboardReady {
  status: "ready";
  source: "sbp-easydata";
  /** ISO time the most recent daily run wrote this snapshot. */
  updatedAt: string;
  indicators: EconomicIndicators;
}

/**
 * Served before the first daily run has ever written a snapshot (a fresh
 * deploy, before the cron's first tick). Deliberately not an empty
 * success and not an error: nothing has been fetched yet, and it says so.
 */
export interface EconomicDashboardPending {
  status: "pending";
  message: string;
}

/**
 * GET /api/economic/dashboard. A 503 `{ error }` is returned instead
 * when the store itself can't be read, matching the other endpoints.
 */
export type EconomicDashboardResponse =
  | EconomicDashboardReady
  | EconomicDashboardPending;
