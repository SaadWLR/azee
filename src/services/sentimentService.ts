import type { MarketBreadth, MarketWatchResponse } from "../types";
import type {
  MarketPulseResponse,
  SentimentSignal,
  SentimentZone,
} from "../types/sentiment";

/**
 * Market Pulse scoring.
 *
 * Pure functions over already-fetched data — no fetch calls, no React,
 * no formatting. Everything here is arithmetic on real PSX numbers,
 * which is what makes it testable and what keeps the "never fabricate"
 * rule enforceable in one place: if a signal cannot be computed, the
 * only thing this file will emit for it is `status: "calibrating"`.
 */

/**
 * Zone bands, half-open upward: a score sits in the first band whose
 * upper bound it is below, and 100 lands in the top band.
 *
 * The boundaries themselves are the published Fear & Greed bands
 * (30 / 45 / 55 / 70) rather than anything derived here — the point of
 * matching them is that a reader who knows the convention reads this
 * gauge the same way.
 */
const ZONE_BANDS: { max: number; zone: SentimentZone }[] = [
  { max: 30, zone: "Extreme Fear" },
  { max: 45, zone: "Fear" },
  { max: 55, zone: "Neutral" },
  { max: 70, zone: "Greed" },
  { max: Infinity, zone: "Extreme Greed" },
];

export function zoneForScore(score: number): SentimentZone {
  return ZONE_BANDS.find((band) => score < band.max)!.zone;
}

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(Math.max(value, lo), hi);

const BREADTH_DESCRIPTION =
  "Advancing vs declining stocks, weighted by the volume behind each side";

/**
 * The one live signal: an Arms Index (TRIN) read of session breadth.
 *
 *   TRIN = (advancers / decliners) / (advancingVolume / decliningVolume)
 *
 * The ratio-of-ratios is what makes this worth computing rather than
 * just counting winners. A day where advancers outnumber decliners two
 * to one sounds bullish, but if the declining side carried most of the
 * volume, the buying was spread thin across small names while the
 * selling was concentrated in large ones. TRIN catches that; a raw
 * advance/decline line does not.
 *
 *   TRIN < 1 → volume is concentrated on the advancing side → greed
 *   TRIN > 1 → volume is concentrated on the declining side → fear
 *
 * MAPPING TO 0-100. TRIN is a ratio, so it is treated geometrically:
 *
 *   score = 50 − 25 · log2(TRIN)
 *
 * A log map is the honest choice for a ratio — TRIN 2 and TRIN 0.5 are
 * the same distance from neutral in opposite directions, and only a
 * log makes them land symmetrically (25 and 75). A linear map would
 * squash every bullish reading into the narrow 0-1 half of the range.
 *
 * The 25 is a deliberate calibration, not a derived constant: it puts
 * TRIN 2.0 at 25 and TRIN 0.5 at 75, so the conventional "strongly
 * oversold / strongly overbought" thresholds land inside the Extreme
 * bands rather than somewhere arbitrary. Saturation is at TRIN 4 and
 * TRIN 0.25.
 */
export function computeBreadthSignal(breadth: MarketBreadth): SentimentSignal {
  const { advancers, decliners, advancingVolume, decliningVolume } = breadth;

  const base = {
    key: "breadth",
    label: "Breadth",
    description: BREADTH_DESCRIPTION,
  };

  /*
   * No directional movement at all in the feed. This is not a neutral
   * market — it is an absence of data, and the two must not render the
   * same. Returning 50 here would be inventing a reading.
   */
  if (advancers + decliners === 0) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote:
        "No advancing or declining symbols in the current feed — waiting on the next session",
    };
  }

  /*
   * Directional counts exist but nothing traded, so the volume half of
   * the ratio is undefined. Falling back to the raw advance/decline
   * line would silently show a DIFFERENT measure under the same label,
   * so it calibrates instead.
   */
  if (advancingVolume + decliningVolume === 0) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote:
        "No traded volume in the current feed — breadth needs volume to weight",
    };
  }

  /*
   * The one-sided cases, handled before the division rather than after
   * it: each is a real, maximal reading, and each would otherwise
   * arrive as Infinity or NaN. No decliners at all — or no volume on
   * the declining side — is as one-sided as breadth gets.
   */
  if (decliners === 0 || decliningVolume === 0) return { ...base, status: "live", score: 100 };
  if (advancers === 0 || advancingVolume === 0) return { ...base, status: "live", score: 0 };

  const trin =
    advancers / decliners / (advancingVolume / decliningVolume);
  const score = clamp(50 - 25 * Math.log2(trin), 0, 100);

  return { ...base, status: "live", score: Math.round(score) };
}

/**
 * The seven signals the finished index needs and this phase cannot
 * compute.
 *
 * They ship visible and named rather than hidden, because a gauge
 * showing one signal out of one reads as complete when it is not. Each
 * note says what would actually unlock it, so the list doubles as the
 * roadmap — and none of them can accidentally acquire a number, since
 * `score` is simply never set here.
 */
const CALIBRATING: SentimentSignal[] = [
  {
    key: "momentum",
    label: "Momentum",
    description: "KSE-100's short-term trend vs its longer-term trend",
    status: "calibrating",
    calibratingNote: "Needs ~90 sessions of price history — pending Phase 2",
  },
  {
    key: "volatility",
    label: "Volatility",
    description: "Recent daily swings vs their own longer-run average",
    status: "calibrating",
    calibratingNote: "Needs ~50 sessions of price history — pending Phase 2",
  },
  {
    key: "priceStrength",
    label: "Price Strength",
    description: "Share of stocks near 52-week highs vs near lows",
    status: "calibrating",
    calibratingNote: "Needs 52-week price history — pending Phase 2",
  },
  {
    key: "volumeMomentum",
    label: "Volume Momentum",
    description: "Recent trading volume vs its longer-run average",
    status: "calibrating",
    calibratingNote: "Needs ~90 sessions of volume history — pending Phase 2",
  },
  {
    key: "safeHaven",
    label: "Safe Haven Demand",
    description: "Gold and USD demand relative to the KSE-100",
    status: "calibrating",
    calibratingNote: "Needs a 2-week price baseline — pending Phase 2",
  },
  {
    key: "derivatives",
    label: "Derivatives Activity",
    description: "Futures activity relative to the ready market",
    status: "calibrating",
    calibratingNote: "Futures/open-interest data not yet sourced",
  },
  {
    key: "foreignFlows",
    label: "Foreign Flows",
    description: "Net foreign investor buying vs selling",
    status: "calibrating",
    calibratingNote: "Blocked on NCCPL data access (same as elsewhere in the roadmap)",
  },
];

/** Breadth's slot when the payload carries no breadth data at all. */
const BREADTH_UNAVAILABLE: SentimentSignal = {
  key: "breadth",
  label: "Breadth",
  description: BREADTH_DESCRIPTION,
  status: "calibrating",
  calibratingNote: "Waiting on the next live market-watch payload",
};

/**
 * Compose the gauge from one market-watch payload.
 *
 * The composite averages the LIVE signals only — a calibrating signal
 * contributes nothing rather than contributing a neutral 50, which
 * would drag every reading toward the middle and quietly make the
 * gauge mostly a measure of how much is still unbuilt.
 *
 * With one live signal that average is just that signal's score; the
 * mean is written out anyway so Phase 2 adds signals without touching
 * this, and so the "live only" rule lives in code rather than in a
 * comment about a special case.
 */
export function buildMarketPulse(
  watch: MarketWatchResponse,
): MarketPulseResponse {
  /*
   * `breadth` is optional on the wire and its absence is a real state,
   * not a bug: the handler serves a warm in-memory lastGood payload,
   * and the edge cache holds up to 30 minutes outside session hours,
   * so requests genuinely arrive without it for a while after a
   * deploy. Absent means "not known yet", never zero.
   */
  const breadthSignal = watch.breadth
    ? computeBreadthSignal(watch.breadth)
    : BREADTH_UNAVAILABLE;

  const signals: SentimentSignal[] = [breadthSignal, ...CALIBRATING];

  const live = signals.filter(
    (s): s is SentimentSignal & { score: number } =>
      s.status === "live" && typeof s.score === "number",
  );

  // No live signal means no composite. Left undefined rather than
  // defaulted — see the note on MarketPulseResponse.score.
  const score = live.length
    ? Math.round(live.reduce((sum, s) => sum + s.score, 0) / live.length)
    : undefined;

  return {
    score,
    zone: score === undefined ? undefined : zoneForScore(score),
    signals,
    asOf: watch.asOf,
    source: watch.source,
    stale: watch.stale,
  };
}
