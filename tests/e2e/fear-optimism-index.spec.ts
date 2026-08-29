import { expect, test } from "./fixtures";

/*
 * The Fear and Optimism Index — the homepage teaser and its dedicated
 * page.
 *
 * The thing worth guarding is not that a gauge renders; it is that it
 * tells the truth about how much it knows. The failures this file
 * exists to catch are a signal with no source acquiring a number, and
 * a page whose prose claims more is live than actually is.
 *
 * WHY THE LIVE COUNT IS NOT A LITERAL. It used to be: three live,
 * five calibrating. Safe Haven Demand ended that — it is live exactly
 * when the recorder has backfilled enough gold history to rank
 * against, so both counts are correct at different times and pinning
 * either one bakes in a lie. The count is now READ from the page and
 * the prose is checked against what was read, which is the property
 * the test is named for. What stays pinned is the list of signals
 * that have no source at all: those must never show a number, and no
 * amount of recorded history can change that.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Index logic is viewport-independent; run once on desktop",
  );
});

const TEASER = 'section[aria-label="Fear and Optimism Index"]';
const PAGE = "/fear-and-optimism-index";

/**
 * Ranked against PSX's own multi-year archive, which every visitor
 * gets on every page load. These are live now and stay live.
 */
const ALWAYS_LIVE = ["Momentum", "Volatility", "Volume Momentum"];

/**
 * Live if and only if the daily recorder has banked enough history.
 *
 * Breadth showed a live score until the percentile pass demoted it: a
 * fixed-curve number is not comparable to a percentile rank, so
 * averaging the two made the composite part formula. It now waits on
 * a history this site records itself, because nobody publishes one.
 * Safe Haven Demand is the same shape — it ranks gold against the
 * index over a fortnight, and needs the recorder's backfilled gold
 * and USD/PKR series to do it.
 *
 * Either state is legitimate. What is NOT legitimate is a score
 * without the history behind it, so these are checked for internal
 * consistency rather than pinned to one status.
 */
const RECORDER_BACKED = ["Breadth", "Safe Haven Demand"];

/**
 * No source at all — not blocked on volume of history, blocked on
 * data that does not exist for us to read. PSX publishes no
 * short-interest or foreign-flow feed we can reach, and the
 * derivatives figures are not in any endpoint this site calls.
 *
 * This is the hard line. A number appearing on any of these means
 * something is being invented, which on a licensed brokerage's site
 * is the worst failure available. It must fail the build.
 */
const NEVER_LIVE = ["Price Strength", "Derivatives Activity", "Foreign Flows"];

const api = () =>
  process.env.E2E_BYPASS_SECRET
    ? { headers: { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET } }
    : {};

/** A signal's row/card, matched on its label EXACTLY. */
const signalCard = (page: import("@playwright/test").Page, label: string) =>
  page
    .locator("main li")
    .filter({ has: page.locator(`span:text-is("${label}")`) })
    .first();

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * The percentile rule, reimplemented from its definition rather than
 * imported. Importing the service would only prove the page calls the
 * function it calls — the test would then agree with any arithmetic
 * the service happened to contain, including wrong arithmetic.
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

/* ── The homepage teaser ────────────────────────────────────────── */

test("the homepage teaser shows the reading and leads to the full page", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto("/");
  const teaser = page.locator(TEASER);
  await expect(teaser).toBeVisible();

  // Five wedges and a needle — the same dial the page draws.
  await expect(teaser.locator("svg path")).toHaveCount(5);
  await expect(teaser.locator("svg line")).toHaveCount(1);

  /*
   * The denominator survives the shrink. A bare score in a hero
   * implies a complete index, so this is the one thing the teaser
   * cannot drop while getting smaller.
   */
  await expect(teaser).toContainText(/3 of 8 signals live/);
  await expect(teaser).not.toContainText(/greed/i);

  // The teaser is a teaser: the detail moved to the page.
  expect(
    await teaser.locator("li").count(),
    "the signal list belongs on the page now, not the hero",
  ).toBe(0);

  await teaser.getByRole("link", { name: /see the full index/i }).click();
  await page.waitForURL(`**${PAGE}`);
  await expect(page.locator("h1")).toHaveText("Fear and Optimism Index");
  expect(pageErrors, "no uncaught exceptions").toEqual([]);
});

/* ── The page ───────────────────────────────────────────────────── */

test("the page renders every section", async ({ page }) => {
  const pageErrors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(PAGE);
  await expect(page.locator("h1")).toHaveText("Fear and Optimism Index");
  const main = page.locator("main");

  // A. Zone legend — five bands with their ranges.
  for (const [zone, range] of [
    ["Extreme Fear", "0–30"],
    ["Fear", "30–45"],
    ["Neutral", "45–55"],
    ["Optimism", "55–70"],
    ["Extreme Optimism", "70–100"],
  ]) {
    await expect(main, `${zone} legend chip`).toContainText(range);
  }

  // B. The dial, with its scale and every zone named on the arc.
  const dial = page.locator('svg[aria-label^="Fear and Optimism Index:"]');
  await expect(dial).toBeVisible();
  await expect(dial.locator("path")).toHaveCount(5);
  for (const tick of ["0", "25", "50", "75", "100"]) {
    await expect(
      dial.locator(`text:text-is("${tick}")`),
      `tick ${tick}`,
    ).toHaveCount(1);
  }

  // Our real cadence, not a borrowed one.
  await expect(main).toContainText(/updates once per trading day/i);

  // C–G.
  await expect(main).toContainText(/Sentiment over time/i);
  await expect(main).toContainText(/Every signal, and where it stands/i);
  await expect(main).toContainText(/Be fearful when others are greedy/);
  await expect(main).toContainText(
    "information tool, not investment advice",
  );
  await expect(main).toContainText(/How the number is produced/i);
  await expect(main).toContainText(/Sources: Pakistan Stock Exchange/);
  await expect(main).toContainText(/Common questions/i);

  /*
   * The sources line must name only what actually feeds the index. An
   * aspirational list would describe a page we have not built.
   */
  const sources = await main
    .locator("p")
    .filter({ hasText: "Sources: Pakistan Stock Exchange" })
    .innerText();
  expect(sources).not.toMatch(/gold|currency|futures|NCCPL|foreign/i);

  expect(pageErrors, "no uncaught exceptions").toEqual([]);
  expect(
    failed.filter((r) => r.includes("/api/market/")),
    "the index's own data sources must not fail",
  ).toEqual([]);
});

test("every section's ground agrees with what it tells the nav", async ({
  page,
}) => {
  /*
   * The navbar is opaque and themes itself from
   * data-nav-theme-section, so a section whose attribute disagrees
   * with its own background puts the wrong bar over it — a white bar
   * on navy, or a navy bar on white.
   *
   * This page shipped with exactly that: the chart section was white
   * with the chart floating in a navy card, and it both broke the
   * navy run either side of it and had to carry a light attribute to
   * stay legible. Making it navy meant removing the attribute too, and
   * the pair is easy to get half-right — hence a check that reads the
   * PAINTED ground and requires the attribute to match it, rather than
   * a list of which sections are which.
   */
  await page.goto(PAGE);
  await expect(page.locator("h1")).toBeVisible();

  const sections = await page.evaluate(() =>
    [...document.querySelectorAll("main > section")].map((el) => ({
      heading: el.querySelector("h1, h2")?.textContent?.trim().slice(0, 30) ?? "(no heading)",
      background: getComputedStyle(el).backgroundColor,
      claimsLight: el.getAttribute("data-nav-theme-section") === "light",
    })),
  );
  expect(sections.length, "the page has its seven sections").toBe(7);

  const disagreements = sections.filter(
    (s) => (s.background === "rgb(255, 255, 255)") !== s.claimsLight,
  );
  expect(
    disagreements,
    "a white section must claim light, and a navy one must not",
  ).toEqual([]);

  // And the rhythm itself: the four-section navy run is the point of
  // the fix, so a white section reappearing inside it fails here.
  const rhythm = sections.map((s) =>
    s.background === "rgb(255, 255, 255)" ? "white" : "navy",
  );
  expect(rhythm).toEqual([
    "navy", // header
    "navy", // gauge
    "navy", // chart
    "navy", // drivers
    "white", // how to read it
    "navy", // methodology
    "white", // FAQ
  ]);
});

test("the page never claims more signals are live than are", async ({
  page,
}) => {
  await page.goto(PAGE);
  const main = page.locator("main");

  /*
   * Wait for the page to settle before counting anything. The three
   * archive-backed signals are always live, so their badges are the
   * signal that both fetches have landed — without this the count
   * below races a page that is still filling in.
   *
   * An auto-waiting assertion, not locator.count(). count() resolves
   * immediately against whatever is in the DOM at that instant, and
   * this page is lazy-loaded and then fills in from two async
   * fetches — so a bare count reads zero badges on a page that is
   * about to render three.
   *
   * Case-insensitive because the badges are uppercased in CSS.
   */
  const liveBadges = main.locator("text=/^Live$/i");
  await expect(
    liveBadges,
    "the archive-backed signals are live",
  ).toHaveCount(ALWAYS_LIVE.length, { timeout: 15_000 });

  /*
   * Now read the truth off the page rather than asserting a literal.
   * Anything above the floor is a recorder-backed signal that has
   * earned its history; anything at or below it means one of the
   * always-live three has broken.
   */
  const liveNow = await liveBadges.count();
  expect(
    liveNow,
    "at least the archive-backed signals are live",
  ).toBeGreaterThanOrEqual(ALWAYS_LIVE.length);
  expect(
    liveNow,
    "no more signals are live than the index actually has sources for",
  ).toBeLessThanOrEqual(ALWAYS_LIVE.length + RECORDER_BACKED.length);

  // Safe to read the prose now that the data has arrived.
  const text = await main.innerText();
  const claims = [...text.matchAll(/(\d+) of (\d+) signals live/g)];
  expect(claims.length, "the reading states its denominator").toBeGreaterThan(0);
  for (const claim of claims) {
    expect(Number(claim[1]), `"${claim[0]}" must match the live cards`).toBe(
      liveNow,
    );
    expect(Number(claim[2])).toBe(8);
  }

  // The methodology paragraph carries the same count.
  expect(text).toContain(`currently ${liveNow} of 8`);

  /*
   * And so does the FAQ — but that answer has to be opened first. The
   * accordion REMOVES closed panels rather than hiding them, so the
   * text is genuinely absent until the question is expanded. That is
   * the point of the component (hidden-but-present text is still read
   * aloud and still found by in-page search), and it means a test
   * cannot assert on collapsed copy.
   */
  await page
    .locator("button[aria-expanded]")
    .filter({ hasText: /How is it calculated/i })
    .click();
  await expect(page.locator("main")).toContainText(
    `currently live: ${liveNow} of 8`,
  );

  for (const label of ALWAYS_LIVE) {
    const card = signalCard(page, label);
    await expect(card, `${label} card`).toHaveCount(1);
    expect(await card.innerText(), `${label} shows a score`).toMatch(/\d/);
  }

  for (const label of NEVER_LIVE) {
    const card = signalCard(page, label);
    await expect(card, `${label} card`).toHaveCount(1);
    const body = await card.innerText();
    expect(body, `${label} is marked calibrating`).toMatch(/calibrating/i);
    // The note is the whole point of an inactive card.
    expect(
      body.replace(/calibrating/i, "").trim().length,
      `${label} explains what unlocks it`,
    ).toBeGreaterThan(20);
  }

  /*
   * The recorder-backed pair may be in either state, but not in a
   * state that misrepresents itself: a live card carries a number, a
   * calibrating card carries a note saying what it is still waiting
   * for. The one thing neither may do is show a bare score with no
   * history behind it, which is what the calibrating branch of each
   * signal exists to prevent.
   */
  for (const label of RECORDER_BACKED) {
    const card = signalCard(page, label);
    await expect(card, `${label} card`).toHaveCount(1);
    const body = await card.innerText();
    if (/calibrating/i.test(body)) {
      expect(
        body.replace(/calibrating/i, "").trim().length,
        `${label} explains what it is waiting for`,
      ).toBeGreaterThan(20);
    } else {
      expect(body, `${label} is live, so it shows a score`).toMatch(/\d/);
    }
  }
});

test("Momentum's score is the percentile the archive implies", async ({
  page,
  request,
}) => {
  const res = await request.get("/api/market/history", api());
  expect(res.ok()).toBe(true);
  const history = await res.json();
  const closes = history.points.map((p: { close: number }) => p.close);
  const last = closes.length - 1;
  const momRaw = (i: number) =>
    (mean(closes.slice(i - 29, i + 1)) - mean(closes.slice(i - 89, i + 1))) /
    mean(closes.slice(i - 89, i + 1));
  const priors: number[] = [];
  for (let j = last - 500; j < last; j++) priors.push(momRaw(j));
  const expected = Math.round(percentileRank(momRaw(last), priors));

  await page.goto(PAGE);
  const card = signalCard(page, "Momentum");
  await expect
    .poll(async () => (await card.innerText()).match(/\b\d{1,3}\b/)?.[0], {
      timeout: 15_000,
    })
    .toBe(String(expected));
});

test("the chart's range tabs change what is plotted", async ({ page }) => {
  await page.goto(PAGE);
  const chart = page.locator('svg[aria-label^="Fear and Optimism Index from"]');
  await expect(chart).toBeVisible();

  const tabs = page.locator('[role="tab"]');
  await expect(tabs).toHaveCount(4);

  const rangeOf = async () => chart.getAttribute("aria-label");
  const threeMonth = await rangeOf();

  await tabs.filter({ hasText: "1Y" }).click();
  await expect.poll(rangeOf, { timeout: 5_000 }).not.toBe(threeMonth);
  const year = await rangeOf();

  await tabs.filter({ hasText: "1M" }).click();
  await expect.poll(rangeOf, { timeout: 5_000 }).not.toBe(year);

  /*
   * A shorter window must plot FEWER points than a longer one. Equal
   * counts would mean the tabs relabel the same data — which is what
   * padding a short series to fill a range looks like from outside.
   */
  const countAt = async (label: string) => {
    await tabs.filter({ hasText: label }).click();
    await page.waitForTimeout(400);
    return chart.locator("line").count();
  };
  const oneMonth = await countAt("1M");
  const sixMonth = await countAt("6M");
  expect(sixMonth, "6M plots more sessions than 1M").toBeGreaterThan(oneMonth);
});

test("the FAQ accordion opens and closes", async ({ page }) => {
  await page.goto(PAGE);
  const questions = page.locator("button[aria-expanded]").filter({
    hasText: /\?$/,
  });
  await expect(questions).toHaveCount(6);

  // The first answer is open on arrival, so the section is never a
  // wall of closed rows with nothing to read.
  await expect(questions.nth(0)).toHaveAttribute("aria-expanded", "true");

  await questions.nth(3).click();
  await expect(questions.nth(3)).toHaveAttribute("aria-expanded", "true");
  // One at a time: opening the fourth closes the first.
  await expect(questions.nth(0)).toHaveAttribute("aria-expanded", "false");

  /*
   * A closed answer must be GONE, not hidden. Text that is only
   * visually hidden is still read by a screen reader and still found
   * by in-page search, which makes "collapsed" a lie.
   */
  const panelId = await questions.nth(3).getAttribute("aria-controls");
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await questions.nth(3).click();
  await expect(questions.nth(3)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`#${panelId}`)).toHaveCount(0);
});

test("comparison cards appear only where the series reaches", async ({
  page,
}) => {
  await page.goto(PAGE);
  const main = page.locator("main");

  // The previous-close delta is always available once there is a
  // series at all.
  await expect(main).toContainText(/vs Previous Close/i);

  /*
   * Each of the three lookbacks is either a card with a real score or
   * absent — never a card with a dash. A placeholder would be a
   * measurement that was never taken, dressed as one that was.
   */
  for (const label of ["1 Week Ago", "1 Month Ago", "1 Year Ago"]) {
    /*
     * .last() is the INNERMOST div containing the label — .first()
     * returns the outermost matching ancestor, which is the whole
     * header section and reads as one enormous "card".
     */
    const card = main
      .locator("div")
      .filter({ has: page.locator("p").filter({ hasText: new RegExp(`^${label}$`, "i") }) })
      .last();
    if ((await card.count()) === 0) continue;
    const body = await card.innerText();
    expect(body, `${label} must carry a real score`).toMatch(/\d/);
    expect(body, `${label} must not be a placeholder`).not.toMatch(/—|--|N\/A/);
  }
});

test("the history endpoint is well-formed and stats stay untouched", async ({
  request,
}) => {
  const history = await (
    await request.get("/api/market/history", api())
  ).json();
  expect(history.points.length).toBeGreaterThan(590);
  const sample = history.points[history.points.length - 1];
  for (const key of ["date", "close", "volume", "indexAverage"]) {
    expect(sample).toHaveProperty(key);
  }
  /*
   * The fourth column is an index level, not money. If PSX ever starts
   * serving real traded value here this fails and someone looks,
   * rather than rupees being fed into a signal expecting index points.
   */
  expect(Math.abs(sample.indexAverage / sample.close - 1)).toBeLessThan(0.1);

  const watch = await (await request.get("/api/market/watch", api())).json();
  expect(watch.stats.map((s: { label: string }) => s.label)).toEqual([
    "Market Volume",
    "Advancers",
    "Decliners",
    "Symbols Traded",
  ]);
  expect(watch.breadth).toBeTruthy();
});
