import { expect, test } from "./fixtures";

/*
 * Real-engine touch coverage. Runs ONLY on the webkit-ipad and
 * chromium-iphone projects (see playwright.config.ts) — WebKit is
 * Safari's actual engine, the closest signal to a real iPad without
 * hardware. Guards two real-device bug classes that Chromium-desktop
 * viewport tests never caught:
 *   B) a fixed header hit-box overlaying the top of the page, blocking
 *      filter taps and table scroll on tablet/phone;
 *   A) animated filter:blur() entrances stuttering on iOS.
 */

/**
 * The core Part B guard. Playwright's tap() refuses to act on an element
 * covered by another (the header overlay bug is exactly that), so a
 * successful tap here — plus the element being topmost at its own centre
 * — proves the overlay is gone. If the header regresses, tap() times out
 * and this fails.
 */
async function filterIsReachable(
  page: import("@playwright/test").Page,
  name: string,
) {
  // Wait for the pill to be visible and the layout to settle first, so
  // the hit-test below isn't racing the initial render / checkpoint
  // redirect.
  const pill = page.getByRole("button", { name, exact: true });
  await pill.waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const topmost = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll("main button")].find(
      (b) => b.textContent?.trim() === label,
    );
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(
      Math.round(r.left + r.width / 2),
      Math.round(r.top + r.height / 2),
    );
    return btn === el || btn.contains(el as Node);
  }, name);
  expect(topmost, `filter "${name}" must be the topmost element at its centre (not under the header)`).toBe(true);
  // Actually tap it — throws/times out if obscured.
  await pill.tap();
}

test("Market Watch filter pills are tappable (no header overlay)", async ({
  page,
}) => {
  await page.goto("/market-watch");
  await expect(page.locator("main table, main").first()).toBeVisible();

  await filterIsReachable(page, "Gainers");
  // Tapping actually applies the filter (its active pill turns solid).
  await expect
    .poll(async () =>
      page.evaluate(() =>
        [...document.querySelectorAll("main button")]
          .find((b) => b.textContent?.trim() === "Gainers")
          ?.className.includes("bg-white"),
      ),
    )
    .toBe(true);
});

test("Corporate Calendar filter pills are tappable (no header overlay)", async ({
  page,
}) => {
  await page.goto("/corporate-calendar");
  await expect(page.locator("main").first()).toBeVisible();
  // AGM is a meetings filter, present by default.
  await filterIsReachable(page, "AGM");
});

test("the fixed header does not cover mid-page content on touch viewports", async ({
  page,
}) => {
  await page.goto("/market-watch");
  await page.waitForTimeout(500);
  const covered = await page.evaluate(() => {
    // A point well below the visible nav but within the old ~620px
    // header hit-box.
    const el = document.elementFromPoint(120, 320);
    let e: Element | null = el;
    while (e) {
      if (e.tagName === "HEADER") return true;
      e = e.parentElement;
    }
    return false;
  });
  expect(covered, "mid-page point must not resolve to the fixed HEADER").toBe(false);
});

test("touch entrance animations drop the blur and still complete", async ({
  page,
}) => {
  await page.goto("/knowledge-centre");

  // Catch a running kc-fade-up animation and confirm its keyframes carry
  // no filter:blur on coarse-pointer devices (the iOS-expensive op).
  const kf = await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const el = [...document.querySelectorAll(".kc-fade-up")].find(
        (e) => e.getAnimations().length > 0,
      );
      if (el) {
        const frames = el.getAnimations()[0].effect?.getKeyframes?.() ?? [];
        const filters = frames
          .map((f) => (f as Record<string, unknown>).filter)
          .filter(Boolean) as string[];
        return { found: true, hasBlur: filters.some((f) => /blur/.test(f)) };
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return { found: false, hasBlur: null };
  });
  expect(kf.found).toBe(true);
  expect(kf.hasBlur).toBe(false);

  // The entrance still completes (the reported symptom was animations
  // "not moving"): every fade-up element settles at full opacity.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const els = [...document.querySelectorAll(".kc-fade-up")];
        return els.length > 0 && els.every((e) => +getComputedStyle(e).opacity === 1);
      }),
    )
    .toBe(true);
});
