import type { MarketBreadth, MarketWatchResponse } from "../types";
import type {
  BreadthPoint,
  EodPoint,
  GoldPoint,
  KseHistoryResponse,
} from "../types/history";
import type {
  FearOptimismResponse,
  SentimentSignal,
  SentimentZone,
} from "../types/sentiment";

/**
 * The Fear and Optimism Index — scoring.
 *
 * Pure functions over already-fetched data. No fetch calls, no React,
 * no formatting: everything here is arithmetic on real PSX numbers,
 * which is what makes it testable and what keeps the "never fabricate"
 * rule enforceable in one place. A signal that cannot be computed gets
 * `status: "calibrating"` and nothing else.
 *
 * THE METHOD CHANGED IN THIS PASS, and the change is the point.
 * Signals used to map a raw reading onto 0-100 through a fixed
 * formula, which meant the number depended entirely on constants
 * someone chose. They are now PERCENTILE RANKS against the same
 * signal's own trailing history: a score of 80 means "higher than 80%
 * of the last two years", which is a statement about this market
 * rather than about a curve someone picked.
 *
 * That has a hard consequence, and it is why Breadth was demoted. A
 * percentile needs history, and history is the one thing a live feed
 * cannot give you retroactively. Three signals can be ranked today
 * because PSX publishes a five-year end-of-day archive. Breadth cannot,
 * because PSX publishes no breadth archive at all — so it is recorded
 * daily from here and stays calibrating until enough sessions exist to
 * rank it fairly.
 */

/**
 * Zone bands, half-open upward: a score sits in the first band whose
 * upper bound it is below, and 100 lands in the top band.
 *
 * The boundaries are the published Fear & Greed thresholds so a reader
 * who knows the convention reads this the same way. Only the warm
 * label differs — see SentimentZone.
 */
const ZONE_BANDS: { max: number; zone: SentimentZone }[] = [
  { max: 30, zone: "Extreme Fear" },
  { max: 45, zone: "Fear" },
  { max: 55, zone: "Neutral" },
  { max: 70, zone: "Optimism" },
  { max: Infinity, zone: "Extreme Optimism" },
];

export function zoneForScore(score: number): SentimentZone {
  return ZONE_BANDS.find((band) => score < band.max)!.zone;
}

/* ── The percentile engine ──────────────────────────────────────── */

/**
 * Percentile rank of `value` within `history` (0-100).
 *
 * Ties count as half. Counting only values strictly below would put
 * every member of a run of identical readings at the run's start, and
 * counting "below or equal" would put them all at its end; a market
 * that has sat at the same reading for a month should rank in the
 * middle of that run, not at whichever edge the comparison operator
 * happened to choose.
 *
 * An empty history has no answer, and 50 would be a fabricated one, so
 * callers must check first — this returns NaN rather than inventing a
 * midpoint, and every caller here guards on sample size long before it
 * gets that far.
 */
export function percentileRank(value: number, history: number[]): number {
  if (history.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const past of history) {
    if (past < value) below++;
    else if (past === value) equal++;
  }
  return ((below + equal / 2) / history.length) * 100;
}

/* ── Lookback windows, in trading sessions ──────────────────────── */

const MOMENTUM_SHORT = 30;
const MOMENTUM_LONG = 90;
const VOL_WINDOW = 20;
const VOL_AVG_WINDOW = 50;
const VOLUME_SHORT = 20;
const VOLUME_LONG = 90;

/**
 * How much of a signal's own past it is ranked against: ~500 sessions,
 * about two years of PSX trading.
 *
 * Required in full rather than treated as a maximum. A percentile
 * against forty prior readings is arithmetic, not evidence — it would
 * produce a confident-looking number off a sample too small to mean
 * anything, which is precisely the kind of false precision the rest of
 * this file exists to avoid. Better to stay calibrating until the
 * window is genuinely there.
 */
const RANK_WINDOW = 500;

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

/**
 * Rank `series[i]` against the RANK_WINDOW readings immediately before
 * it, or undefined if that many do not exist.
 *
 * Strictly prior: today is ranked against its history, never against
 * itself, so a reading cannot nudge its own percentile.
 */
function rankAt(series: (number | undefined)[], i: number): number | undefined {
  const start = i - RANK_WINDOW;
  if (start < 0) return undefined;
  const history: number[] = [];
  for (let j = start; j < i; j++) {
    const raw = series[j];
    if (raw !== undefined) history.push(raw);
  }
  if (history.length < RANK_WINDOW) return undefined;
  const today = series[i];
  if (today === undefined) return undefined;
  return percentileRank(today, history);
}

/* ── Raw signal series ──────────────────────────────────────────── */

/*
 * Each returns an array aligned index-for-index with `points`, holding
 * that session's RAW reading or undefined where the lookback does not
 * reach. Computing the whole series once is what lets today's live
 * score and the multi-year historical reconstruction share exactly one
 * implementation — the number on the gauge is produced by the same
 * code that produced the number a year ago.
 *
 * `points` must be oldest-first; the API sorts it that way.
 */

/** 30-session close trend against the 90-session trend, scaled by it. */
function momentumRawSeries(points: EodPoint[]): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(points.length).fill(undefined);
  for (let i = MOMENTUM_LONG - 1; i < points.length; i++) {
    const short = mean(
      points.slice(i - MOMENTUM_SHORT + 1, i + 1).map((p) => p.close),
    );
    const long = mean(
      points.slice(i - MOMENTUM_LONG + 1, i + 1).map((p) => p.close),
    );
    if (long <= 0) continue;
    out[i] = (short - long) / long;
  }
  return out;
}

/** 20-session realized volatility against its own 50-session average. */
function volatilityRawSeries(points: EodPoint[]): (number | undefined)[] {
  const n = points.length;
  // Daily returns; index t is the return INTO session t, so [0] is
  // undefined by construction.
  const returns: (number | undefined)[] = new Array(n).fill(undefined);
  for (let t = 1; t < n; t++) {
    const prev = points[t - 1].close;
    if (prev > 0) returns[t] = points[t].close / prev - 1;
  }

  // Rolling standard deviation of those returns.
  const vol: (number | undefined)[] = new Array(n).fill(undefined);
  for (let t = VOL_WINDOW; t < n; t++) {
    const window: number[] = [];
    for (let j = t - VOL_WINDOW + 1; j <= t; j++) {
      const r = returns[j];
      if (r !== undefined) window.push(r);
    }
    if (window.length < VOL_WINDOW) continue;
    const m = mean(window);
    vol[t] = Math.sqrt(mean(window.map((r) => (r - m) ** 2)));
  }

  // Current volatility relative to its own recent norm. The ratio, not
  // the level, is what says "unusually turbulent for this market".
  const out: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = VOL_WINDOW + VOL_AVG_WINDOW - 1; i < n; i++) {
    const window: number[] = [];
    for (let j = i - VOL_AVG_WINDOW + 1; j <= i; j++) {
      const v = vol[j];
      if (v !== undefined) window.push(v);
    }
    if (window.length < VOL_AVG_WINDOW) continue;
    const avg = mean(window);
    const today = vol[i];
    if (today === undefined || avg <= 0) continue;
    out[i] = today / avg;
  }
  return out;
}

/**
 * 20-session average volume against the 90-session average, SIGNED by
 * the direction price moved over the same stretch.
 *
 * Volume on its own has no mood. A surge is panic or euphoria
 * depending entirely on which way the market went while it happened,
 * so an unsigned volume ratio would score a crash and a rally
 * identically. Multiplying by the direction of the 20-session price
 * change is what turns "a lot of trading" into "a lot of buying" or "a
 * lot of selling".
 *
 * Uses SHARE VOLUME, not traded value. PSX's end-of-day archive
 * carries volume in shares and does not publish a traded-value column
 * at all — see EodPoint.indexAverage for what the fourth field turned
 * out to be. Shares are the quantity this signal is named for anyway.
 */
function volumeRawSeries(points: EodPoint[]): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(points.length).fill(undefined);
  for (let i = VOLUME_LONG - 1; i < points.length; i++) {
    const short = mean(
      points.slice(i - VOLUME_SHORT + 1, i + 1).map((p) => p.volume),
    );
    const long = mean(
      points.slice(i - VOLUME_LONG + 1, i + 1).map((p) => p.volume),
    );
    if (long <= 0) continue;
    const direction = Math.sign(points[i].close - points[i - VOLUME_SHORT].close);
    out[i] = (short / long - 1) * direction;
  }
  return out;
}

/* ── The signals ────────────────────────────────────────────────── */

interface SignalSpec {
  key: string;
  label: string;
  description: string;
  /** Sessions of raw lookback the formula itself needs. */
  lookback: number;
  series: (points: EodPoint[]) => (number | undefined)[];
  /** True when a HIGH raw reading means fear rather than optimism. */
  inverted?: boolean;
}

const MOMENTUM: SignalSpec = {
  key: "momentum",
  label: "Momentum",
  description: "KSE-100's 30-session trend against its 90-session trend",
  lookback: MOMENTUM_LONG,
  series: momentumRawSeries,
};

const VOLATILITY: SignalSpec = {
  key: "volatility",
  label: "Volatility",
  description: "Recent daily swings against their own longer-run average",
  lookback: VOL_WINDOW + VOL_AVG_WINDOW,
  series: volatilityRawSeries,
  // A market swinging harder than usual is a frightened one, so the
  // rank is flipped: high volatility ranks toward fear.
  inverted: true,
};

const VOLUME_MOMENTUM: SignalSpec = {
  key: "volumeMomentum",
  label: "Volume Momentum",
  description: "Recent traded volume against its longer-run average, signed by price direction",
  lookback: VOLUME_LONG,
  series: volumeRawSeries,
};

/** Sessions needed before a spec can produce its first ranked score. */
const requiredPoints = (spec: SignalSpec) => spec.lookback + RANK_WINDOW;

function signalFrom(spec: SignalSpec, points: EodPoint[]): SentimentSignal {
  const base = { key: spec.key, label: spec.label, description: spec.description };

  /*
   * Defensive rather than expected: PSX's archive currently runs to
   * ~1,240 sessions, comfortably past the ~590 this needs. It matters
   * anyway — an archive that came back short would otherwise rank
   * against whatever it had and present the result with the same
   * confidence as a full window.
   */
  if (points.length < requiredPoints(spec)) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote: `Needs ~${requiredPoints(spec)} sessions of KSE-100 history to rank against; the archive currently returns ${points.length}`,
    };
  }

  const raw = spec.series(points);
  const rank = rankAt(raw, points.length - 1);
  if (rank === undefined || !Number.isFinite(rank)) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote:
        "The latest session could not be ranked against its own history",
    };
  }

  return {
    ...base,
    status: "live",
    score: Math.round(spec.inverted ? 100 - rank : rank),
  };
}

export function computeMomentumSignal(points: EodPoint[]): SentimentSignal {
  return signalFrom(MOMENTUM, points);
}

export function computeVolatilitySignal(points: EodPoint[]): SentimentSignal {
  return signalFrom(VOLATILITY, points);
}

export function computeVolumeMomentumSignal(
  points: EodPoint[],
): SentimentSignal {
  return signalFrom(VOLUME_MOMENTUM, points);
}

/* ── Breadth ────────────────────────────────────────────────────── */

const BREADTH_DESCRIPTION =
  "Advancing vs declining stocks, weighted by the volume behind each side";

/**
 * One session's Arms Index (TRIN), or null when the session cannot
 * produce one.
 *
 *   TRIN = (advancers / decliners) / (advancingVolume / decliningVolume)
 *
 * The ratio-of-ratios is what makes this worth computing rather than
 * counting winners: a day where advancers outnumber decliners two to
 * one looks bullish until you notice the declining side carried most
 * of the volume, meaning the buying was spread thin across small names
 * while the selling was concentrated in large ones.
 *
 * Every divide-by-zero is answered BEFORE the division, so none can
 * reach a caller as NaN or Infinity. The one-sided cases return the
 * extreme they actually represent; the two no-data cases return null,
 * because an absence of readings is not a neutral market and must not
 * be recorded as one.
 *
 * This logic is unchanged from when it drove a live score directly —
 * it simply feeds the recorder and the percentile path now instead of
 * a fixed formula.
 */
export function computeTrin(breadth: MarketBreadth): number | null {
  const { advancers, decliners, advancingVolume, decliningVolume } = breadth;

  if (advancers + decliners === 0) return null;
  if (advancingVolume + decliningVolume === 0) return null;

  // Maximal one-sidedness. TRIN's own scale is unbounded below and
  // above, so these use finite sentinels well outside any real
  // session's range rather than 0 and Infinity.
  if (decliners === 0 || decliningVolume === 0) return 0.01;
  if (advancers === 0 || advancingVolume === 0) return 100;

  return advancers / decliners / (advancingVolume / decliningVolume);
}

/**
 * Breadth's slot.
 *
 * DEMOTED IN THIS PASS, deliberately and visibly. It previously showed
 * a live score from a fixed TRIN-to-100 curve. That number was real
 * arithmetic on real data, but it was not comparable to the other
 * signals: theirs say "higher than N% of the last two years", and a
 * fixed curve says "wherever a constant someone chose puts it". Mixing
 * the two in one average would have made the composite partly a
 * percentile and partly a formula.
 *
 * So it waits, exactly as Foreign Flows does — the difference being
 * that this one has a recorder running, and graduates on its own the
 * moment the history is deep enough. Nothing needs to be deployed for
 * that to happen.
 *
 * A LOW TRIN IS OPTIMISM, so the rank is inverted.
 */
export function computeBreadthSignal(
  breadth?: MarketBreadth,
  trinHistory?: BreadthPoint[],
): SentimentSignal {
  const base = {
    key: "breadth",
    label: "Breadth",
    description: BREADTH_DESCRIPTION,
  };

  const history = trinHistory ?? [];
  const today = breadth ? computeTrin(breadth) : null;

  if (today !== null && history.length >= RANK_WINDOW) {
    const window = history.slice(-RANK_WINDOW).map((p) => p.trin);
    const rank = percentileRank(today, window);
    if (Number.isFinite(rank)) {
      return { ...base, status: "live", score: Math.round(100 - rank) };
    }
  }

  return {
    ...base,
    status: "calibrating",
    calibratingNote: `Collecting live history — will join the composite once it has enough sessions to be ranked fairly (same treatment as Foreign Flows). ${history.length} of ${RANK_WINDOW} recorded so far`,
  };
}

/* ── Safe Haven Demand ──────────────────────────────────────────── */

const SAFE_HAVEN_DESCRIPTION =
  "Two-week returns on gold in rupees and US dollars against the KSE-100";

/** Sessions in a "two-week" return — a fortnight of PSX trading. */
const SAFE_HAVEN_LOOKBACK = 10;

/**
 * Money hiding in gold reads as fear.
 *
 * The metric is gold's two-week return measured against the KSE-100's
 * over the same stretch, in BOTH currencies:
 *
 *   goldUsd = xauUsd[d] / xauUsd[d-10] - 1
 *   goldPkr = (xauUsd[d] * usdPkr[d]) / (xauUsd[d-10] * usdPkr[d-10]) - 1
 *   kse     = close[d] / close[d-10] - 1
 *   raw     = ((goldUsd - kse) + (goldPkr - kse)) / 2
 *
 * Both currencies, averaged rather than chosen between, because they
 * answer different questions for a Pakistani investor: the dollar leg
 * is the global flight-to-safety trade, the rupee leg is what a local
 * holder actually experienced, and a rupee sliding against the dollar
 * shows up in one and not the other.
 *
 * INVERTED. Gold outperforming equities is fear, so a high raw reading
 * ranks toward the fearful end — the same inversion Volatility and
 * Breadth's TRIN use.
 *
 * ALIGNED BY DATE, NEVER BY INDEX. The two series come from different
 * places and have gaps in different places: PSX closes for local
 * holidays the currency CDN publishes straight through, and the CDN
 * misses days PSX traded. Walking two arrays in step would silently
 * compare a Tuesday's gold against the previous Thursday's index the
 * moment either side skipped a row.
 */
export function computeSafeHavenSignal(
  goldHistory: GoldPoint[] | undefined,
  kseHistory: EodPoint[],
): SentimentSignal {
  const base = {
    key: "safeHaven",
    label: "Safe Haven Demand",
    description: SAFE_HAVEN_DESCRIPTION,
  };

  const gold = goldHistory ?? [];
  const closeOn = new Map(kseHistory.map((p) => [p.date, p.close]));

  /*
   * Only sessions BOTH sources describe, in date order. The lookback
   * counts back through this shared calendar rather than through
   * either source's own, so "ten sessions ago" means ten sessions the
   * signal can actually see.
   */
  const shared = gold
    .filter((g) => closeOn.has(g.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const raws: number[] = [];
  for (let i = SAFE_HAVEN_LOOKBACK; i < shared.length; i++) {
    const now = shared[i];
    const then = shared[i - SAFE_HAVEN_LOOKBACK];
    const closeNow = closeOn.get(now.date)!;
    const closeThen = closeOn.get(then.date)!;
    if (
      !(now.xauUsd > 0) ||
      !(then.xauUsd > 0) ||
      !(now.usdPkr > 0) ||
      !(then.usdPkr > 0) ||
      !(closeThen > 0)
    ) {
      continue;
    }
    const goldUsd = now.xauUsd / then.xauUsd - 1;
    const goldPkr =
      (now.xauUsd * now.usdPkr) / (then.xauUsd * then.usdPkr) - 1;
    const kse = closeNow / closeThen - 1;
    raws.push((goldUsd - kse + (goldPkr - kse)) / 2);
  }

  /*
   * Same window as every other signal, and required in full for the
   * same reason: a percentile against forty prior readings is
   * arithmetic, not evidence.
   */
  if (raws.length <= RANK_WINDOW) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote: `Backfilling gold and USD/PKR history — ${raws.length} of ${RANK_WINDOW} sessions ranked so far`,
    };
  }

  const today = raws[raws.length - 1];
  const window = raws.slice(-(RANK_WINDOW + 1), -1);
  const rank = percentileRank(today, window);
  if (!Number.isFinite(rank)) {
    return {
      ...base,
      status: "calibrating",
      calibratingNote:
        "The latest session could not be ranked against its own history",
    };
  }

  return { ...base, status: "live", score: Math.round(100 - rank) };
}

/* ── The signals that are still blocked ─────────────────────────── */

const BLOCKED: SentimentSignal[] = [
  {
    key: "priceStrength",
    label: "Price Strength",
    description: "Share of stocks near 52-week highs vs near lows",
    status: "calibrating",
    calibratingNote:
      "Needs per-symbol 52-week ranges; PSX publishes no such archive",
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
    calibratingNote:
      "Blocked on NCCPL data access (same as elsewhere in the roadmap)",
  },
];

/** The archive is absent entirely — a different state from "too short". */
const HISTORY_UNAVAILABLE = (spec: SignalSpec): SentimentSignal => ({
  key: spec.key,
  label: spec.label,
  description: spec.description,
  status: "calibrating",
  calibratingNote: "Waiting on the KSE-100 history feed",
});

/* ── The composite ──────────────────────────────────────────────── */

/** Mean of the live signals only, or undefined when none are. */
function compositeOf(signals: SentimentSignal[]): number | undefined {
  const live = signals.filter(
    (s): s is SentimentSignal & { score: number } =>
      s.status === "live" && typeof s.score === "number",
  );
  if (!live.length) return undefined;
  return Math.round(live.reduce((sum, s) => sum + s.score, 0) / live.length);
}

export function buildFearAndOptimismIndex(
  watch: MarketWatchResponse,
  history?: KseHistoryResponse,
): FearOptimismResponse {
  const points = history?.points ?? [];
  const haveHistory = points.length > 0;

  const signals: SentimentSignal[] = [
    haveHistory ? computeMomentumSignal(points) : HISTORY_UNAVAILABLE(MOMENTUM),
    haveHistory
      ? computeVolatilitySignal(points)
      : HISTORY_UNAVAILABLE(VOLATILITY),
    haveHistory
      ? computeVolumeMomentumSignal(points)
      : HISTORY_UNAVAILABLE(VOLUME_MOMENTUM),
    computeBreadthSignal(watch.breadth, history?.breadthHistory),
    computeSafeHavenSignal(history?.goldHistory, points),
    ...BLOCKED,
  ];

  const score = compositeOf(signals);

  return {
    score,
    zone: score === undefined ? undefined : zoneForScore(score),
    signals,
    // The index is only as fresh as the slower of its two inputs, and
    // the history feed is the slower one whenever it is present.
    asOf: history?.asOf ?? watch.asOf,
    source: history?.source === "cache" ? "cache" : watch.source,
    stale: watch.stale || history?.stale,
  };
}

/* ── Reconstructed history ──────────────────────────────────────── */

export interface HistoricalScore {
  date: string;
  score: number;
  zone: SentimentZone;
}

/**
 * The composite, rebuilt for every past session the archive can
 * support.
 *
 * This is possible only because the three live signals are functions
 * of the EOD series alone — every past day's score is computed by the
 * same code that computes today's, ranked against the 500 sessions
 * that preceded THAT day rather than against today's window. It is a
 * reconstruction, not a recording, and it is honest because nothing in
 * it uses information the market did not have on the day.
 *
 * ONE THING TO WATCH when Breadth graduates: this series will still be
 * the three history-backed signals, because no reconstruction of
 * breadth is possible before the recorder started. Today that is
 * invisible — the same three signals are live in both places — but
 * once Breadth joins the live composite, today's score will average
 * four signals while every historical point averages three. That is a
 * real methodological seam, and the comparison chips built on this
 * series will need to say so rather than imply a like-for-like
 * comparison.
 */
export function buildHistoricalSeries(
  history: KseHistoryResponse,
): HistoricalScore[] {
  const points = history.points;
  const specs = [MOMENTUM, VOLATILITY, VOLUME_MOMENTUM];

  // Each raw series computed once for the whole archive, then ranked
  // per day — rather than recomputing the lookbacks inside the loop.
  const series = specs.map((spec) => ({
    spec,
    raw: spec.series(points),
  }));

  const firstRankable = Math.max(...specs.map(requiredPoints)) - 1;
  const out: HistoricalScore[] = [];

  for (let i = firstRankable; i < points.length; i++) {
    const scores: number[] = [];
    for (const { spec, raw } of series) {
      const rank = rankAt(raw, i);
      if (rank === undefined || !Number.isFinite(rank)) continue;
      scores.push(spec.inverted ? 100 - rank : rank);
    }
    // A day is only emitted with the full set. A point averaging two
    // signals sitting in a line of three-signal points would be a
    // different measurement wearing the same axis.
    if (scores.length !== specs.length) continue;
    const score = Math.round(mean(scores));
    out.push({ date: points[i].date, score, zone: zoneForScore(score) });
  }

  return out;
}

export interface ComparisonChips {
  /** Today's score minus the previous session's. */
  vsPreviousClose: number;
  oneWeekAgo?: HistoricalScore;
  oneMonthAgo?: HistoricalScore;
  oneYearAgo?: HistoricalScore;
}

/**
 * Find the series entry nearest to `daysBack` calendar days before the
 * latest one, or undefined if the series does not reach that far.
 *
 * Matched on real DATES rather than counting sessions back, because
 * "a week ago" means a week — an index that counts five rows back
 * silently drifts every time the exchange closes for a holiday, and
 * PSX closes often.
 *
 * The tolerance stops a near-miss becoming a confident answer: a
 * request for one year ago will accept the nearest session within a
 * fortnight of the target and otherwise return nothing, rather than
 * handing back the oldest point it has and calling it a year.
 */
function entryNear(
  series: HistoricalScore[],
  daysBack: number,
  toleranceDays: number,
): HistoricalScore | undefined {
  if (!series.length) return undefined;
  const latest = new Date(`${series[series.length - 1].date}T00:00:00Z`);
  const target = new Date(latest);
  target.setUTCDate(target.getUTCDate() - daysBack);

  let best: HistoricalScore | undefined;
  let bestGap = Infinity;
  for (const entry of series) {
    const gap = Math.abs(
      (new Date(`${entry.date}T00:00:00Z`).getTime() - target.getTime()) /
        86_400_000,
    );
    if (gap < bestGap) {
      bestGap = gap;
      best = entry;
    }
  }
  return bestGap <= toleranceDays ? best : undefined;
}

export function computeComparisonChips(
  series: HistoricalScore[],
): ComparisonChips {
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];

  return {
    vsPreviousClose:
      latest && previous ? latest.score - previous.score : 0,
    // Tolerances scale with the distance asked for: a few days' slack
    // on a week, a fortnight on a year.
    oneWeekAgo: entryNear(series, 7, 4),
    oneMonthAgo: entryNear(series, 30, 7),
    oneYearAgo: entryNear(series, 365, 14),
  };
}
