import { expect, test } from "./fixtures";

/*
 * The Fear and Optimism Index — the sentiment gauge in the hero's
 * live-market zone.
 *
 * The thing worth guarding is not that a gauge renders; it is that the
 * gauge tells the truth about how much it knows. Three signals are
 * live, five are not, and the failure this file exists to catch is a
 * change that lets any of the five acquire a number — or quietly drops
 * them so the panel looks complete.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Index logic is viewport-independent; run once on desktop",
  );
});

const GAUGE = 'section[aria-label="Fear and Optimism Index"]';

/**
 * The row for one signal, matched on its label EXACTLY.
 *
 * hasText does substring matching, so "Momentum" also selects "Volume
 * Momentum" — two rows where the test expects one.
 */
const signalRow = (page: import("@playwright/test").Page, label: string) =>
  page
    .locator(`${GAUGE} li`)
    .filter({ has: page.locator(`span:text-is("${label}")`) });

/** Ranked against PSX's own archive, so live today. */
const LIVE = ["Momentum", "Volatility", "Volume Momentum"];

/**
 * Not computable yet — INCLUDING Breadth, which this pass demoted.
 *
 * Breadth previously showed a live score from a fixed TRIN curve. That
 * number was real arithmetic on real data, but it was not comparable
 * to a percentile rank, so mixing the two in one average made the
 * composite partly a formula. It now waits for its own recorded
 * history, and this list is where that change is pinned: if Breadth
 * ever shows a score again without the recorder having filled ~500
 * sessions, this fails.
 */
const CALIBRATING = [
  "Breadth",
  "Price Strength",
  "Safe Haven Demand",
  "Derivatives Activity",
  "Foreign Flows",
];

/** The WAF bypass header, when the suite has the secret. */
const api = () =>
  process.env.E2E_BYPASS_SECRET
    ? { headers: { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET } }
    : {};

/**
 * The percentile rule, reimplemented from its documented definition
 * rather than imported from the app.
 *
 * Importing the service would only prove the component calls the
 * function it calls — the test would agree with any arithmetic the
 * service happened to contain, including wrong arithmetic. Written out
 * independently, changing the maths takes a deliberate change in two
 * places.
 */
function percentileRank(value: number, history: number[]): number {
  let below = 0;
  let equal = 0;
  for (const past of history) {
    if (past < value) below++;
    else if (past === value) equal++;
  }
  return ((below + equal / 2) / history.length) * 100;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

test("the gauge renders three live percentile signals", async ({ page }) => {
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });

  await page.goto("/");
  const gauge = page.locator(GAUGE);
  await expect(gauge).toBeVisible();

  // Five zone bands, drawn from the geometry rather than implied.
  await expect(gauge.locator("svg path")).toHaveCount(5);

  // The dial's warm end is Optimism now, not Greed — anywhere on this
  // panel.
  await expect(gauge).not.toContainText(/greed/i);

  for (const label of LIVE) {
    const row = signalRow(page, label);
    await expect(row, `${label} must be listed`).toHaveCount(1);
    const head = await row.locator("div").first().innerText();
    expect(head, `${label} must carry a score`).toMatch(/[0-9]/);
    expect(head, `${label} must not be calibrating`).not.toMatch(
      /calibrating/i,
    );
    const score = Number(head.match(/([0-9]+)\s*$/)?.[1]);
    expect(score, `${label} score is a percentile`).toBeGreaterThanOrEqual(0);
    expect(score, `${label} score is a percentile`).toBeLessThanOrEqual(100);
  }

  await expect(gauge).toContainText(/3 of 8 signals live/);

  expect(pageErrors, "no uncaught exceptions").toEqual([]);
  expect(
    failedRequests.filter(
      (r) => r.includes("/api/market/watch") || r.includes("/api/market/history"),
    ),
    "the index's own data sources must not fail",
  ).toEqual([]);
  if (failedRequests.length) {
    console.log(`  (unrelated failed requests: ${failedRequests.join(", ")})`);
  }
});

test("Momentum's score is the percentile the archive actually implies", async ({
  page,
  request,
}) => {
  /*
   * End to end on the arithmetic: pull the same archive the page
   * pulled, recompute Momentum's raw reading and its rank here, and
   * require the rendered number to match. This is the check that the
   * deployed endpoint, the scoring service and the component all agree
   * on one number rather than each being plausible on its own.
   */
  const res = await request.get("/api/market/history", api());
  expect(res.ok(), "the history endpoint must answer").toBe(true);
  const history = await res.json();

  expect(Array.isArray(history.points)).toBe(true);
  expect(
    history.points.length,
    "PSX's archive must cover the 590 sessions a ranked signal needs",
  ).toBeGreaterThan(590);

  // Oldest-first, as the API promises.
  expect(history.points[0].date < history.points[history.points.length - 1].date).toBe(
    true,
  );

  const closes = history.points.map((p: { close: number }) => p.close);
  const last = closes.length - 1;
  const momRaw = (i: number) => {
    const ma30 = mean(closes.slice(i - 29, i + 1));
    const ma90 = mean(closes.slice(i - 89, i + 1));
    return (ma30 - ma90) / ma90;
  };
  const priors: number[] = [];
  for (let j = last - 500; j < last; j++) priors.push(momRaw(j));
  const expected = Math.round(percentileRank(momRaw(last), priors));

  await page.goto("/");
  const row = signalRow(page, "Momentum");
  await expect
    .poll(async () => (await row.locator("div").first().innerText()).match(/[0-9]+/)?.[0], {
      timeout: 15_000,
    })
    .toBe(String(expected));
});

test("five signals stay calibrating, Breadth among them", async ({ page }) => {
  await page.goto("/");
  const gauge = page.locator(GAUGE);
  await expect(gauge).toBeVisible();

  await expect(gauge.locator("li")).toHaveCount(8);

  for (const label of CALIBRATING) {
    const row = signalRow(page, label);
    await expect(row, `${label} must be listed`).toHaveCount(1);

    /*
     * The label/badge line, read apart from the note below it. That
     * split is what makes the digit check meaningful: a note may
     * legitimately carry a figure ("0 of 500 recorded"), but the slot
     * where a SCORE would render must be free of one. Matched
     * case-insensitively because the badge is uppercased in CSS.
     */
    const head = await row.locator("div").first().innerText();
    expect(head, `${label} must be marked calibrating`).toMatch(
      /calibrating/i,
    );
    expect(
      head,
      `${label} must show no number where a score would go`,
    ).not.toMatch(/[0-9]/);

    const note = await row.locator("p").first().innerText();
    expect(
      note.trim().length,
      `${label} must explain what unlocks it`,
    ).toBeGreaterThan(15);
  }

  // Breadth's note must say it is accumulating, not that it is broken.
  const breadthNote = await signalRow(page, "Breadth")
    .locator("p")
    .first()
    .innerText();
  expect(breadthNote).toMatch(/collecting live history/i);
  expect(breadthNote).toMatch(/recorded so far/i);

  await expect(gauge).toContainText(
    "The Fear and Optimism Index is an information tool, not investment",
  );
});

test("the history endpoint is additive and well-formed", async ({
  request,
}) => {
  const res = await request.get("/api/market/history", api());
  const history = await res.json();

  for (const key of ["points", "asOf", "source"]) {
    expect(history, `history.${key} must be present`).toHaveProperty(key);
  }
  const sample = history.points[history.points.length - 1];
  for (const key of ["date", "close", "volume", "indexAverage"]) {
    expect(sample, `an EOD point carries ${key}`).toHaveProperty(key);
  }
  expect(sample.close).toBeGreaterThan(0);
  expect(sample.volume).toBeGreaterThan(0);
  expect(sample.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  /*
   * The fourth column is an index level, not money. Guarded because
   * the whole reason it carries this name is that "value" invited
   * exactly the misreading — if PSX ever starts serving real traded
   * value here, this fails and someone looks rather than silently
   * feeding rupees into a signal that expects index points.
   */
  expect(
    Math.abs(sample.indexAverage / sample.close - 1),
    "indexAverage must track the close, as an index level does",
  ).toBeLessThan(0.1);

  // The watch payload's stats array is still untouched by any of this.
  const watch = await (await request.get("/api/market/watch", api())).json();
  expect(watch.stats.map((s: { label: string }) => s.label)).toEqual([
    "Market Volume",
    "Advancers",
    "Decliners",
    "Symbols Traded",
  ]);
  expect(watch.breadth).toBeTruthy();
});
