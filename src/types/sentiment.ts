/**
 * The Fear and Optimism Index — a sentiment read composed from live
 * PSX signals.
 *
 * THE HONESTY CONTRACT IS THE POINT OF THESE TYPES. The gauge shows
 * eight signals because eight is what the finished index needs; only
 * the ones we can actually compute from real data carry a number. A
 * signal we cannot compute is present, named, and explicitly marked
 * calibrating with a note saying what would unlock it — it never
 * borrows a neighbour's value, never gets a placeholder, and never
 * gets quietly dropped from the list so the page looks complete.
 */

/**
 * The five bands, named for what they describe.
 *
 * "Greed" became "Optimism". The published Fear & Greed convention
 * uses the harsher word, but this sits on a licensed broker's own
 * homepage, where telling visitors the market is greedy reads as a
 * judgement on them rather than a description of conditions. The
 * bands, the thresholds and the direction are unchanged — only the
 * label at the warm end.
 */
export type SentimentZone =
  | "Extreme Fear"
  | "Fear"
  | "Neutral"
  | "Optimism"
  | "Extreme Optimism";

export interface SentimentSignal {
  key: string;
  label: string;
  /** 0-100. Absent while calibrating — never a stand-in value. */
  score?: number;
  status: "live" | "calibrating";
  /** Shown when status is "calibrating" — what unlocks this signal. */
  calibratingNote?: string;
  /**
   * Shown under the description on a LIVE signal that is still short
   * of its full ranking window — a recorded signal (Breadth, Safe
   * Haven Demand) early in its expanding-window ramp-up. Absent once a
   * signal reaches the full window, and never set on the three
   * archive-backed signals, which only ever go live at full strength.
   */
  sampleNote?: string;
  description: string;
}

export interface FearOptimismResponse {
  /**
   * Composite 0-100, averaged over the LIVE signals only.
   *
   * Optional, deliberately. The obvious shape here is a required
   * number, but the composite is a mean over the live signals and
   * there is a real case — every signal calibrating — where that mean
   * is 0/0. Today Breadth is the only live signal, so any request that
   * arrives without usable breadth data lands in exactly that case,
   * and a warm lambda or a cached edge response can genuinely serve
   * one. A required field would have to be filled with something, and
   * the only honest something is nothing.
   */
  score?: number;
  /** Absent whenever `score` is — a zone is a reading of a score. */
  zone?: SentimentZone;
  signals: SentimentSignal[];
  asOf: string;
  source: "psx" | "cache";
  stale?: boolean;
}
