import { expect, test } from "@playwright/test";
import { rsi, rsiZone, sma, type Closes } from "../../src/lib/indicators";

/*
 * The indicator arithmetic itself, checked three ways: against values
 * worked out by hand below, against a second implementation written
 * independently of the one under test, and at the boundaries where too
 * little history must return null rather than a number.
 *
 * Pure functions, no network and no page — this runs in every project.
 */

const series = (closes: number[]): Closes[] => closes.map((close) => ({ close }));

/** Walk a series of closes into the gains and losses RSI is built from. */
function changes(closes: number[]): { gains: number[]; losses: number[] } {
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    gains.push(Math.max(delta, 0));
    losses.push(Math.max(-delta, 0));
  }
  return { gains, losses };
}

/**
 * A second RSI, written from the definition in a different shape from
 * the implementation under test: it materialises the gain/loss arrays
 * first, then folds Wilder's smoothing over them with reduce. Two
 * implementations agreeing on real market data is the check that the
 * one shipping is not quietly wrong in the same way twice.
 */
function referenceRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const { gains, losses } = changes(closes);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  let avgGain = mean(gains.slice(0, period));
  let avgLoss = mean(losses.slice(0, period));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  if (avgGain === 0) return 0;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** A deterministic pseudo-random walk — real-shaped, reproducible. */
function walk(length: number, seed = 7): number[] {
  let state = seed;
  let price = 100;
  const closes: number[] = [price];
  for (let i = 1; i < length; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    price = Math.max(1, price + ((state % 2001) - 1000) / 250);
    closes.push(Math.round(price * 100) / 100);
  }
  return closes;
}

test("SMA is the mean of the last N closes, and null below N", () => {
  // 1…50 average to 25.5 — (1 + 50) / 2.
  expect(sma(series(Array.from({ length: 50 }, (_, i) => i + 1)), 50)).toBeCloseTo(25.5, 10);

  // Only the LAST N count: 100 sessions of 1 followed by 50 of 7.
  const tail = series([...Array(100).fill(1), ...Array(50).fill(7)].map(Number));
  expect(sma(tail, 50)).toBeCloseTo(7, 10);
  expect(sma(tail, 150)).toBeCloseTo((100 * 1 + 50 * 7) / 150, 10);

  // Exactly N is enough; one short is not.
  expect(sma(series(Array(200).fill(3)), 200)).toBeCloseTo(3, 10);
  expect(sma(series(Array(199).fill(3)), 200)).toBeNull();
  expect(sma([], 50)).toBeNull();
});

test("RSI-14 matches values worked out by hand", () => {
  /*
   * Fifteen closes = fourteen changes: ten of +1 and four of −1. The
   * seed averages are then 10/14 and 4/14, so RS = 2.5 and
   * RSI = 100 − 100/3.5 = 71.428571…
   */
  const seed = [100];
  for (let i = 0; i < 10; i++) seed.push(seed[seed.length - 1] + 1);
  for (let i = 0; i < 4; i++) seed.push(seed[seed.length - 1] - 1);
  expect(seed).toHaveLength(15);
  expect(rsi(series(seed), 14)).toBeCloseTo(100 - 100 / 3.5, 10);

  /*
   * One more session, a +1 gain, exercises the smoothing step:
   *   avgGain = (10/14 × 13 + 1) / 14 = 0.734693877…
   *   avgLoss = ( 4/14 × 13 + 0) / 14 = 0.265306122…
   *   RS = 2.769230769… → RSI = 100 − 100/3.769230769… = 73.469387…
   */
  const smoothed = [...seed, seed[seed.length - 1] + 1];
  expect(rsi(series(smoothed), 14)).toBeCloseTo(73.46938775510203, 8);
});

test("RSI-14 agrees with an independently written implementation on market-shaped data", () => {
  for (const seed of [7, 11, 99, 1234]) {
    for (const length of [15, 40, 250, 1240]) {
      const closes = walk(length, seed);
      const mine = rsi(series(closes), 14);
      const reference = referenceRsi(closes, 14);
      expect(mine, `seed ${seed}, ${length} sessions`).not.toBeNull();
      expect(mine!, `seed ${seed}, ${length} sessions`).toBeCloseTo(reference!, 10);
      // A real RSI is on RSI's scale.
      expect(mine!).toBeGreaterThanOrEqual(0);
      expect(mine!).toBeLessThanOrEqual(100);
    }
  }
});

test("RSI-14 reports its edges as the formula's own limits", () => {
  const rising = Array.from({ length: 30 }, (_, i) => 10 + i);
  const falling = Array.from({ length: 30 }, (_, i) => 100 - i);
  expect(rsi(series(rising), 14)).toBe(100); // no losses at all
  expect(rsi(series(falling), 14)).toBe(0); // no gains at all
  // A stretch that never moved has no ratio either way; reported as the
  // midpoint rather than as an extreme.
  expect(rsi(series(Array(30).fill(42)), 14)).toBe(50);
});

test("RSI-14 needs 15 closes — 14 changes — and returns null below that", () => {
  const closes = walk(20);
  expect(rsi(series(closes.slice(0, 15)), 14)).not.toBeNull();
  expect(rsi(series(closes.slice(0, 14)), 14)).toBeNull();
  expect(rsi(series(closes.slice(0, 2)), 14)).toBeNull();
  expect(rsi([], 14)).toBeNull();
});

test("RSI zones are Wilder's published 70/30 thresholds", () => {
  expect(rsiZone(70.01)).toBe("overbought");
  expect(rsiZone(70)).toBe("neutral"); // the threshold itself is not past it
  expect(rsiZone(50)).toBe("neutral");
  expect(rsiZone(30)).toBe("neutral");
  expect(rsiZone(29.99)).toBe("oversold");
});
