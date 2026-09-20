/**
 * Technical indicators AZEE computes from PSX's published closing
 * prices. Nothing here is sourced from PSX — PSX publishes prices, not
 * indicators — and nothing here interprets a number into advice.
 *
 * CLOSES ONLY, and end-of-day only. The archive these read carries one
 * close per session (see EodPoint), so every figure describes the market
 * up to the last published close, not the live session on screen above
 * it. Intraday highs and lows never enter the arithmetic.
 *
 * TOO LITTLE HISTORY RETURNS null, never a number computed from fewer
 * sessions than the indicator names. A "50-session average" of 30
 * sessions is a different statistic wearing the same label, and a
 * symbol listed six months ago genuinely has no SMA-200 — the page says
 * so rather than printing something that looks authoritative.
 */

/** Closing prices, oldest first — the shape EodPoint[] already has. */
export interface Closes {
  close: number;
}

/**
 * Simple moving average: the mean of the last `period` closes.
 *
 * Returns null when fewer than `period` sessions exist. The window is
 * the END of the series, so the caller passes the whole archive and gets
 * the current value.
 */
export function sma(points: Closes[], period: number): number | null {
  if (!Number.isInteger(period) || period < 1) return null;
  if (points.length < period) return null;
  let total = 0;
  for (let i = points.length - period; i < points.length; i++) {
    total += points[i].close;
  }
  return total / period;
}

/**
 * Relative Strength Index over `period` sessions, using WILDER'S
 * smoothing — the original definition, and the one every charting
 * package means by "RSI-14".
 *
 * Seeded on the first `period` changes as a simple mean of gains and of
 * losses, then each later session folds in with
 * (previous × (period − 1) + current) / period. A plain rolling mean of
 * the last 14 changes is a different indicator that happens to share the
 * name, and would disagree with any other chart a reader compares this
 * against.
 *
 * Needs `period` + 1 closes, because `period` changes need one more
 * price than changes. Returns null below that.
 *
 * Losses are carried as positive magnitudes. A stretch with no losses at
 * all divides by zero in the ratio, so it is answered directly as 100
 * (and an all-loss stretch as 0), which is the limit the formula
 * approaches rather than a special case invented here.
 */
export function rsi(points: Closes[], period = 14): number | null {
  if (!Number.isInteger(period) || period < 1) return null;
  if (points.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = points[i].close - points[i - 1].close;
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < points.length; i++) {
    const change = points[i].close - points[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  if (avgGain === 0) return 0;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * Where an RSI value sits on RSI's own 0–100 scale.
 *
 * "Overbought" and "oversold" are the conventional names for the zones
 * above 70 and below 30 — Wilder's own thresholds, printed on every RSI
 * chart. They describe the number, not what anyone should do about it,
 * and this file draws that line deliberately: no buy, sell, hold,
 * bullish or bearish reading is derived here or anywhere downstream.
 */
export type RsiZone = "overbought" | "neutral" | "oversold";

export function rsiZone(value: number): RsiZone {
  if (value > 70) return "overbought";
  if (value < 30) return "oversold";
  return "neutral";
}
