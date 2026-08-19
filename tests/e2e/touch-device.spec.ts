import { expect, test } from "./fixtures";

/*
 * Real-engine touch coverage. Runs ONLY on the webkit-ipad and
 * chromium-iphone projects (see playwright.config.ts) — WebKit is
 * Safari's actual engine, the closest signal to a real iPad without
 * hardware. Guards three real-device bug classes that Chromium-desktop
 * viewport tests never caught:
 *   B) a fixed header hit-box overlaying the top of the page, blocking
 *      filter taps and table scroll on tablet/phone;
 *   A) animated filter:blur() entrances stuttering on iOS;
 *   C) the mobile menu running past the bottom of the screen with no
 *      way to scroll the rest into view (reported from a real device
 *      screenshot, not from this suite — which is why the height guard
 *      below exists at all).
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

/* ── C) Mobile menu drill-down ─────────────────────────────────── */

/** The mobile panel — the toggle's aria-controls target. */
const MOBILE_MENU = "#mobile-menu";

async function openMobileMenu(page: import("@playwright/test").Page) {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.waitFor({ state: "visible" });
  await toggle.tap();
  await expect(page.locator(MOBILE_MENU)).toBeVisible();
}

/** Visible, tappable rows of whichever menu view is showing. */
async function menuRows(page: import("@playwright/test").Page) {
  return page
    .locator(`${MOBILE_MENU} ul >> css=a, ${MOBILE_MENU} ul >> css=button`)
    .allInnerTexts();
}

test("mobile menu top level shows the 5 nav links plus one Tools row", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-iphone",
    "Phone-sized menu behaviour; the iPad profile shows the desktop nav",
  );
  await openMobileMenu(page);

  const rows = (await menuRows(page)).map((t) => t.trim());
  expect(rows).toEqual([
    "Markets",
    "Research",
    "Trading",
    "Forex & Commodities",
    "About",
    "Tools",
  ]);

  /*
   * The regression itself: Tools' seven links used to render inline
   * here, pushing the panel past the screen. Not one of them may be
   * present at the top level now.
   */
  const menu = page.locator(MOBILE_MENU);
  for (const tool of [
    "Market Watch",
    "Indices",
    "Commodity Futures",
    "ETFs",
    "Announcements",
    "Calendar",
    "Economic Dashboard",
  ]) {
    await expect(menu.getByRole("link", { name: tool, exact: true })).toHaveCount(0);
  }

  // The primary action stays reachable from the top level.
  await expect(menu.getByRole("link", { name: "Client Login" })).toBeVisible();
});

test("tapping Tools drills into a Tools-only view, and Back returns", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-iphone",
    "Phone-sized menu behaviour; the iPad profile shows the desktop nav",
  );
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  await menu.getByRole("button", { name: "Tools", exact: true }).tap();

  // Exactly the seven tools, in their two groups, and nothing else.
  const rows = (await menuRows(page)).map((t) => t.trim());
  expect(rows).toEqual([
    "Market Watch",
    "Indices",
    "Commodity Futures",
    "ETFs",
    "Announcements",
    "Calendar",
    "Economic Dashboard",
  ]);
  // Group headings carried over from the desktop dropdown.
  await expect(menu).toContainText("Markets");
  await expect(menu).toContainText("Research");
  // The top-level nav links are NOT also showing.
  await expect(
    menu.getByRole("link", { name: "Forex & Commodities", exact: true }),
  ).toHaveCount(0);
  // Client Login is pinned outside the swapped view, so it survives.
  await expect(menu.getByRole("link", { name: "Client Login" })).toBeVisible();

  // Back returns to the top level.
  await menu.getByRole("button", { name: "Back", exact: true }).tap();
  const back = (await menuRows(page)).map((t) => t.trim());
  expect(back).toEqual([
    "Markets",
    "Research",
    "Trading",
    "Forex & Commodities",
    "About",
    "Tools",
  ]);
});

test("closing the menu resets the drill-down to the top level", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-iphone",
    "Phone-sized menu behaviour; the iPad profile shows the desktop nav",
  );
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  await menu.getByRole("button", { name: "Tools", exact: true }).tap();
  await expect(menu.getByRole("button", { name: "Back", exact: true })).toBeVisible();

  // Close, then reopen — must land on the top level, not stay in Tools.
  await page.getByRole("button", { name: "Close menu" }).tap();
  await page.getByRole("button", { name: "Open menu" }).tap();

  await expect(menu.getByRole("button", { name: "Tools", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

test("the open mobile menu never extends past the viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-iphone",
    "Phone-sized menu behaviour; the iPad profile shows the desktop nav",
  );
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  /*
   * The actual reported bug, asserted directly: the panel's bottom edge
   * must sit inside the viewport in BOTH views. A drill-down that stays
   * short today is not enough — the scroll container is what keeps this
   * true when a group grows, so it is checked, not assumed.
   */
  for (const step of ["top level", "tools"] as const) {
    if (step === "tools") {
      await menu.getByRole("button", { name: "Tools", exact: true }).tap();
    }
    const fits = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const scroller = el.querySelector("[class*=overflow-y-auto]") as HTMLElement | null;
      return {
        bottom: Math.round(r.bottom),
        viewport: window.innerHeight,
        hasScroller: !!scroller,
        // A scroll container that can actually scroll when it needs to.
        scrollable: scroller
          ? getComputedStyle(scroller).overflowY === "auto"
          : false,
      };
    }, MOBILE_MENU);
    expect(fits, `menu measurable in ${step}`).not.toBeNull();
    expect(fits!.hasScroller, `${step}: menu has a bounded scroll area`).toBe(true);
    expect(fits!.scrollable, `${step}: that area scrolls on overflow`).toBe(true);
    expect(
      fits!.bottom,
      `${step}: menu bottom (${fits!.bottom}px) must fit the ${fits!.viewport}px viewport`,
    ).toBeLessThanOrEqual(fits!.viewport);
  }
});
