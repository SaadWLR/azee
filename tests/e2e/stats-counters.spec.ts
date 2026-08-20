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

const STATS_SECTION = "section:has(.particle)";
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
  await page.locator(STATS_SECTION).first().scrollIntoViewIfNeeded();

  // The real published figures — 20+ years, 10,000+ investors,
  // 450+ margin-eligible symbols, 2 exchanges.
  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});

test("no stat figure can ever render as 0", async ({ page }) => {
  await page.goto("/");
  await page.locator(STATS_SECTION).first().scrollIntoViewIfNeeded();
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
  await page.locator(STATS_SECTION).first().scrollIntoViewIfNeeded();

  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});

test("figures resolve immediately when reduced motion is preferred", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(STATS_SECTION).first().scrollIntoViewIfNeeded();

  await expect
    .poll(async () => await figures(page), { timeout: 15_000 })
    .toEqual(["20", "10000", "450", "2"]);
});
