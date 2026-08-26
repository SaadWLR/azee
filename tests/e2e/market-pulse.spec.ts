import { expect, test } from "./fixtures";

/*
 * Market Pulse — the sentiment gauge in the hero's live-market zone.
 *
 * The thing worth guarding here is not that a gauge renders; it is
 * that the gauge tells the truth about how much it knows. One signal
 * is live, seven are not, and the failure this file exists to catch is
 * a future change that lets any of the seven acquire a number — or
 * quietly drops them so the panel looks complete.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Gauge logic is viewport-independent; run once on desktop",
  );
});

const GAUGE = 'section[aria-label="Market Pulse"]';

/**
 * The row for one signal, matched on its label EXACTLY.
 *
 * hasText does substring matching, so "Momentum" also selects "Volume
 * Momentum" — two rows where the test expects one. Matching the label
 * span with :text-is keeps each of the eight addressable on its own.
 */
const signalRow = (page: import("@playwright/test").Page, label: string) =>
  page
    .locator(`${GAUGE} li`)
    .filter({ has: page.locator(`span:text-is("${label}")`) });

/** The seven that cannot be computed yet, in render order. */
const CALIBRATING = [
  "Momentum",
  "Volatility",
  "Price Strength",
  "Volume Momentum",
  "Safe Haven Demand",
  "Derivatives Activity",
  "Foreign Flows",
];

/**
 * The scoring, reimplemented from the published rule rather than
 * imported from the app.
 *
 * Importing computeBreadthSignal would only prove the component calls
 * the function it calls — the test would agree with any arithmetic the
 * service happened to contain, including wrong arithmetic. Writing the
 * TRIN formula out independently means the assertion is against the
 * rule itself, so a change to the maths has to be a deliberate change
 * in two places.
 */
function expectedBreadthScore(b: {
  advancers: number;
  decliners: number;
  advancingVolume: number;
  decliningVolume: number;
}): number | null {
  if (b.advancers + b.decliners === 0) return null;
  if (b.advancingVolume + b.decliningVolume === 0) return null;
  if (b.decliners === 0 || b.decliningVolume === 0) return 100;
  if (b.advancers === 0 || b.advancingVolume === 0) return 0;
  const trin =
    b.advancers / b.decliners / (b.advancingVolume / b.decliningVolume);
  return Math.round(Math.min(Math.max(50 - 25 * Math.log2(trin), 0), 100));
}

test("the gauge renders, and its Breadth score is the live PSX breadth", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  const gauge = page.locator(GAUGE);
  await expect(gauge).toBeVisible();

  /*
   * The dial is drawn, not implied: five zone bands, and — once a
   * score exists — a needle. An idle gauge deliberately has no needle
   * rather than one parked at neutral, so this waits for the score
   * first.
   */
  await expect(gauge.locator("svg path")).toHaveCount(5);

  // The same payload the page is reading.
  const res = await request.get("/api/market/watch", {
    headers: process.env.E2E_BYPASS_SECRET
      ? { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET }
      : {},
  });
  expect(res.ok()).toBe(true);
  const watch = await res.json();

  expect(
    watch.breadth,
    "the watch payload must carry raw breadth numbers",
  ).toBeTruthy();
  const { advancers, decliners, unchanged } = watch.breadth;

  /*
   * THE TWO SURFACES MUST AGREE. `stats` is the display copy the
   * Market Watch page prints; `breadth` is the arithmetic the gauge
   * runs on. They are computed from the same quote table, so a
   * divergence means one of them drifted — which is exactly the bug a
   * separate breadth field could introduce.
   */
  const stat = (label: string) =>
    watch.stats.find((s: { label: string }) => s.label === label)?.value;
  expect(String(advancers), "breadth.advancers vs the stats array").toBe(
    stat("Advancers"),
  );
  expect(String(decliners), "breadth.decliners vs the stats array").toBe(
    stat("Decliners"),
  );
  expect(
    String(advancers + decliners + unchanged),
    "the three counts must account for every symbol traded",
  ).toBe(stat("Symbols Traded"));

  // Volume sums are liquidity-filtered, so they can only ever be a
  // subset of the session total — never more than the whole market.
  const totalShares = watch.quotes.reduce(
    (sum: number, q: { volume?: number }) => sum + (q.volume ?? 0),
    0,
  );
  expect(
    watch.breadth.advancingVolume + watch.breadth.decliningVolume,
  ).toBeLessThanOrEqual(totalShares);

  // And the rendered number is the one the rule produces.
  const expected = expectedBreadthScore(watch.breadth);
  const breadthRow = signalRow(page, "Breadth");
  await expect(breadthRow).toHaveCount(1);

  if (expected === null) {
    await expect(breadthRow).toContainText("Calibrating");
  } else {
    await expect
      .poll(async () => (await breadthRow.innerText()).match(/\d+/)?.[0], {
        timeout: 15_000,
      })
      .toBe(String(expected));
    // With a score there is a needle, and a composite equal to it —
    // the mean of one live signal is that signal.
    await expect(gauge.locator("svg line")).toHaveCount(1);
    const headline = await gauge.locator("p.font-display").innerText();
    expect(headline.trim()).toBe(String(expected));
  }

  expect(errors, "no console errors").toEqual([]);
});

test("seven signals are present, marked calibrating, and carry no number", async ({
  page,
}) => {
  await page.goto("/");
  const gauge = page.locator(GAUGE);
  await expect(gauge).toBeVisible();

  // All eight are rendered — none hidden to make the panel look done.
  await expect(gauge.locator("li")).toHaveCount(8);

  for (const label of CALIBRATING) {
    const row = signalRow(page, label);
    await expect(row, `${label} must be listed`).toHaveCount(1);

    /*
     * The label/badge line, read apart from the note below it. That
     * split is what makes the digit check meaningful: a note may
     * legitimately carry a figure ("~90 sessions"), but the slot where
     * a SCORE would render must be free of one. Matched
     * case-insensitively because the badge is uppercased in CSS, so
     * innerText returns "CALIBRATING".
     */
    const head = await row.locator("div").first().innerText();
    expect(head, `${label} must be marked calibrating`).toMatch(
      /calibrating/i,
    );
    expect(
      head,
      `${label} must show no number where a score would go`,
    ).not.toMatch(/[0-9]/);

    // The note is the whole point of an inactive slot: it must say
    // what would turn the signal on.
    const note = await row.locator("p").first().innerText();
    expect(
      note.trim().length,
      `${label} must explain what unlocks it`,
    ).toBeGreaterThan(15);
  }

  // The denominator is stated rather than left to be assumed.
  await expect(gauge).toContainText(/1 of 8 signals live/);

  // And the disclaimer is present verbatim.
  await expect(gauge).toContainText(
    "Market Pulse is an information tool, not investment advice",
  );
});

test("adding breadth did not disturb the existing watch payload", async ({
  request,
}) => {
  /*
   * The breadth field is additive, and "additive" is a claim worth
   * testing rather than asserting in a commit message. The stats array
   * is what the Market Watch page and the hero snapshot both print, so
   * its shape and its four labels are the contract that must not have
   * moved.
   */
  const res = await request.get("/api/market/watch", {
    headers: process.env.E2E_BYPASS_SECRET
      ? { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET }
      : {},
  });
  const watch = await res.json();

  expect(watch.stats.map((s: { label: string }) => s.label)).toEqual([
    "Market Volume",
    "Advancers",
    "Decliners",
    "Symbols Traded",
  ]);
  expect(watch.stats).toHaveLength(4);
  for (const s of watch.stats) {
    expect(typeof s.value).toBe("string");
  }
  // The other top-level fields the page depends on are all still here.
  for (const key of ["quotes", "stats", "asOf", "source"]) {
    expect(watch, `watch.${key} must survive`).toHaveProperty(key);
  }
  expect(Array.isArray(watch.quotes)).toBe(true);
  expect(watch.quotes.length).toBeGreaterThan(100);
});
