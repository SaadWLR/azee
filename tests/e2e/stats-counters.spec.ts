import { expect, test } from "./fixtures";

/*
 * The homepage Stats row — the firm's real credential figures.
 *
 * These count up from 0 when scrolled into view. The regression this
 * guards: the displayed value only left 0 once requestAnimationFrame
 * started firing, so a throttled frame clock (backgrounded tab, reduced
 * motion, low-power mode) could leave the row reading "0+ Years in
 * Capital Markets" — a false claim about the business, not a cosmetic
 * glitch.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Stat counters are viewport-independent; run once on desktop",
  );
});

/*
 * Identified by one of its own stat labels. NOT by ".particle" — the
 * Hero renders the same drifting-particle field, so a `.particle`
 * selector matches two sections and silently resolves to the Hero,
 * whose own numbers would then be asserted instead of these.
 */
const STATS_SECTION = 'section:has(p:text-is("Years in Capital Markets"))';
/** The big number in each stat card. */
const FIGURES = `${STATS_SECTION} p.tabular-nums`;

/** Every rendered figure, digits only. */
async function figures(page: import("@playwright/test").Page) {
  return (await page.locator(FIGURES).allInnerTexts()).map((t) =>
    t.replace(/[^\d]/g, ""),
  );
}

test("stat figures reach their real values in the normal case", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();

  // The real published figures — 20+ years, 10,000+ investors,
  // 450+ margin-eligible symbols, 2 exchanges.
  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});

test("no stat figure can ever render as 0", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();
  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);

  const rendered = await page.locator(FIGURES).allInnerTexts();
  for (const text of rendered) {
    expect(text.trim(), "a stat must never read 0").not.toMatch(/^0\+?$/);
  }
});

test("figures still resolve when the frame clock is unavailable", async ({
  page,
}) => {
  /*
   * Reproduces the original failure condition directly: rAF is stubbed
   * to never invoke its callback, exactly as a throttled/backgrounded
   * tab behaves. Before the fix this pinned every figure at 0; the
   * pre-flight check and watchdog must now still land the real values.
   */
  await page.addInitScript(() => {
    // @ts-expect-error deliberately breaking the frame clock for the test
    window.requestAnimationFrame = () => 0;
  });
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();

  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});

test("figures resolve immediately when reduced motion is preferred", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();

  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});

test("the resting markup holds real figures before the row is scrolled to", async ({
  page,
}) => {
  /*
   * The count-up starts from zero, but zero must never be what the
   * page RESTS at — a full-page screenshot or a crawler reading before
   * any scroll would otherwise capture "0+ Years in Capital Markets".
   * The figures therefore render true and only drop to zero once the
   * animation is committed to, off-screen, via the observer's
   * rootMargin.
   */
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  // Deliberately NOT scrolled into view.
  await page.waitForTimeout(1200);

  const resting = await page.locator(FIGURES).allInnerTexts();
  expect(resting.length).toBe(4);
  for (const text of resting) {
    expect(text.trim(), "no figure may rest at zero").not.toMatch(/^0\+?$/);
  }
});
