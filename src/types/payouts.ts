/** Payout instrument as marked by PSX: (D) cash, (B) bonus, (R) rights. */
export type PayoutKind = "dividend" | "bonus" | "rights";

/** Whether PSX marked the payout interim — (i)/(ii)/(iii) — or final, (F). */
export type PayoutPeriod = "interim" | "final";

/**
 * A dividend / bonus / rights announcement from PSX's payouts table.
 *
 * `announcement` is PSX's verbatim text and is the authoritative
 * record; every other field is derived from it and is deliberately
 * optional, because the real notation carries nuance a simplified
 * enum would lose. Observed live variants include compound
 * announcements ("25%(i) (D)  -  25%(i) (D)") and free-text rights
 * terms ("23.855376% AT A PREMIUM RS.10/= PER SHARES (R)"). When a
 * derived field can't be determined unambiguously it is omitted
 * rather than guessed — read `announcement` for the full truth.
 */
export interface Payout {
  symbol: string;
  companyName: string;
  sector: string;
  /** PSX's verbatim announcement text — authoritative. */
  announcement: string;
  /** Instruments named in the announcement; may be more than one. */
  kinds: PayoutKind[];
  /** Percent of face value. Omitted when the text carries more than
   *  one percentage (compound) or none — see `announcement`. */
  percent?: number;
  /** Omitted for announcements PSX doesn't mark (e.g. most rights). */
  period?: PayoutPeriod;
  /** 1/2/3 for (i)/(ii)/(iii); only set when period is "interim". */
  interimNumber?: number;
  /** ISO timestamp of the announcement (PSX publishes in PKT). */
  announcedAt: string;
  /** Book closure window, ISO dates, plus PSX's verbatim range. */
  bookClosureFrom?: string;
  bookClosureTo?: string;
  bookClosureRaw?: string;
}

/** Payload of /api/payouts/latest. */
export interface PayoutsResponse {
  payouts: Payout[];
  /** Total announcements PSX holds, of which `payouts` is the newest slice. */
  totalAvailable?: number;
  /** ISO time of the underlying PSX fetch. */
  asOf: string;
  /** Where the payload came from. */
  source: "psx" | "cache";
  /** True when serving the last known-good value during an outage. */
  stale?: boolean;
}
