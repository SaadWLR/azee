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

/** Exactly what the four figures must read once settled. */
const SETTLED = ["20+", "10,000+", "450+", "2"];

test("no stat figure is ever LEFT reading 0", async ({ page }) => {
  /*
   * The count-up legitimately passes THROUGH zero — it is a count-up;
   * it starts there. What must never happen is the row coming to rest
   * on it, which is what a stalled frame clock used to produce.
   *
   * This test used to say "can ever render as 0" and enforce it that
   * literally, which was wrong twice over. It polled digits-only until
   * they matched, then took a SECOND, separate raw read and failed if
   * that one saw a bare 0 — and the poll could not do the job it was
   * relied on for, because the resting markup ALREADY holds the true
   * figures by design (see the last test in this file). So the poll was
   * routinely satisfied before the animation had even begun, and the
   * follow-up read then landed inside the count and saw "0+".
   * Reproduced against production: the poll was satisfied before the
   * animation started in 3 runs out of 8, and 2 of those 8 failed here.
   *
   * The fix is to make it ONE atomic read, polled until the row
   * settles, compared against the exact user-visible strings. A figure
   * stuck at "0+" — or at anything else — still fails, and now fails
   * with a diff that names the value instead of a race.
   */
  await page.goto("/");
  await expect(page.locator(STATS_SECTION)).toHaveCount(1);
  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();

  await expect
    .poll(
      async () =>
        (await page.locator(FIGURES).allInnerTexts()).map((t) => t.trim()),
      { timeout: 15_000 },
    )
    .toEqual(SETTLED);
});

test("a frame that began before the count did never renders a negative", async ({
  page,
}) => {
  /*
   * The regression this pins down, found while chasing the flake above.
   *
   * The easing read t = Math.min((now - start) / duration, 1) — clamped
   * above, not below. `start` is performance.now() read inside the task
   * that schedules the frame, while `now` is the time the browser says
   * that frame BEGAN, and a frame already underway when the task runs
   * carries an earlier timestamp. t then goes negative, and because
   * eased = 1 - (1 - t)³ that falls below zero, so the row renders
   * figures like "-612+ Investors Served".
   *
   * Observed organically on production in 2 of 10 foreground loads
   * (down to "-301+") before the clamp landed. Rather than sample and
   * hope, this forces the ordering: offsetting performance.now() and
   * leaving rAF timestamps alone makes `start` read later than the
   * frames, which is the exact condition.
   *
   * The offset is large on purpose. At 40ms the guard was one-sided
   * but leaky — it caught the unfixed code in 5 runs out of 6, missing
   * whenever the first frame happened to land beyond the window. 250ms
   * is far wider than any first-frame delay, so every early frame is
   * inside it. It still cannot fail falsely: against clamped code the
   * row simply holds 0 a little longer before counting.
   */
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    performance.now = () => realNow() + 250;
  });
  await page.goto("/");

  // Record every distinct value the row ever holds, not just the ends.
  await page.evaluate(() => {
    const w = window as unknown as { __statFrames: string[][] };
    w.__statFrames = [];
    const read = () => {
      const section = [...document.querySelectorAll("section")].find((s) =>
        [...s.querySelectorAll("p")].some(
          (p) => p.textContent?.trim() === "Years in Capital Markets",
        ),
      );
      return section
        ? [...section.querySelectorAll("p.tabular-nums")].map((p) =>
            (p as HTMLElement).innerText.trim(),
          )
        : null;
    };
    let last = "";
    new MutationObserver(() => {
      const values = read();
      if (!values) return;
      const key = values.join(",");
      if (key !== last) {
        last = key;
        w.__statFrames.push(values);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

  await page.locator(STATS_SECTION).scrollIntoViewIfNeeded();

  /*
   * Waited on the RECORDING, not on a fresh read of the DOM — and this
   * is the same trap the test above was rewritten to escape. The
   * resting markup already equals SETTLED, so polling the live text
   * can be satisfied before the animation starts, and the frames would
   * then be read while the count was still to come. Requiring the
   * recording to have several entries AND to end on the settled values
   * proves the animation both ran and finished.
   */
  await expect
    .poll(
      async () =>
        await page.evaluate((settled) => {
          const f = (window as unknown as { __statFrames: string[][] })
            .__statFrames;
          const last = f[f.length - 1];
          // Several frames deep AND resting on the real values: the
          // first recorded frame is the resting markup, which already
          // matches, so the length is what proves the count ran.
          return f.length > 5 && !!last && last.join() === settled.join();
        }, SETTLED),
      { timeout: 15_000 },
    )
    .toBe(true);

  const frames = await page.evaluate(
    () => (window as unknown as { __statFrames: string[][] }).__statFrames,
  );
  const negative = frames.filter((f) => f.some((v) => v.startsWith("-")));
  expect(
    negative,
    "no frame of the count may render a negative figure",
  ).toEqual([]);
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
