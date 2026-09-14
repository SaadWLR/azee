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

/** The view currently mounted in the menu's scroll area. */
const VIEW = `${MOBILE_MENU} [data-menu-view]`;

/**
 * Navigation LINKS of whichever view is showing. Deliberately links
 * only: the view's controls (group rows, Back) are buttons and are
 * asserted by name where they matter, which keeps this list exactly
 * "the places this view can take you".
 */
async function menuLinks(page: import("@playwright/test").Page) {
  return (await page.locator(`${VIEW} a`).allInnerTexts()).map((t) => t.trim());
}

/** Which view is mounted — "main" or a group's slug. */
async function currentView(page: import("@playwright/test").Page) {
  return page.locator(VIEW).getAttribute("data-menu-view");
}

/** The three groups in menu order, each with its links in order (Navbar's NAV_GROUPS). */
const GROUPS = [
  {
    heading: "Markets",
    view: "markets",
    links: ["Market Watch", "PSX Indices", "PMEX Commodities", "ETFs", "Mutual Funds"],
  },
  {
    heading: "Corporate & Events",
    view: "corporate-events",
    links: ["Company Announcements", "Corporate Calendar", "Economic Dashboard"],
  },
  {
    heading: "Research & News",
    view: "research-news",
    links: ["Knowledge Centre", "Fear and Optimism Index"],
  },
];

/** The top level's plain links, after the three group rows. */
const TOP_LEVEL_LINKS = ["Trading", "Forex & Commodities", "About"];

const phoneOnly = (projectName: string) =>
  test.skip(
    projectName !== "chromium-iphone",
    "Phone-sized menu behaviour; the iPad profile shows the desktop nav",
  );

/** Does the mounted view fit without scrolling, last row on screen? */
async function viewFit(page: import("@playwright/test").Page) {
  return page.locator(MOBILE_MENU).evaluate((panel) => {
    const scroller = panel.firstElementChild as HTMLElement;
    const rows = [...panel.querySelectorAll("[data-menu-view] a, [data-menu-view] button")];
    return {
      needed: scroller.scrollHeight,
      available: scroller.clientHeight,
      lastBottom: rows.at(-1)!.getBoundingClientRect().bottom,
      viewport: window.innerHeight,
    };
  });
}

test("every menu view fits a phone screen without scrolling", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  /*
   * The iPhone 14 profile is 390×664. With the groups as their own
   * drill-downs the tallest view is Markets (five links plus Back and a
   * heading), measured at 301px needed; the top level at 270px. This
   * keeps that true for every view: the scroll container must not need
   * to scroll, and the last row must end on screen — not merely be
   * reachable by scrolling.
   */
  const main = await viewFit(page);
  expect(main.needed, "top level must not scroll").toBeLessThanOrEqual(main.available);
  expect(main.lastBottom).toBeLessThanOrEqual(main.viewport);

  for (const group of GROUPS) {
    await menu.getByRole("button", { name: group.heading, exact: true }).tap();
    await expect(page.locator(`${MOBILE_MENU} [data-menu-view="${group.view}"]`)).toBeVisible();
    const fit = await viewFit(page);
    expect(fit.needed, `${group.heading} view must not scroll`).toBeLessThanOrEqual(fit.available);
    expect(fit.lastBottom).toBeLessThanOrEqual(fit.viewport);
    await menu.getByRole("button", { name: "Back", exact: true }).tap();
    expect(await currentView(page)).toBe("main");
  }
});

test("mobile menu top level shows three group rows plus three plain links", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  expect(await currentView(page)).toBe("main");

  // Same six entries, same order, as the desktop bar: three group rows
  // (controls, not links) then three links.
  const rows = await page.locator(`${VIEW} > li > :is(a, button)`).evaluateAll((els) =>
    els.map((el) => `${el.tagName === "BUTTON" ? "group" : "link"}:${el.textContent!.trim()}`),
  );
  expect(rows).toEqual([
    ...GROUPS.map((g) => `group:${g.heading}`),
    ...TOP_LEVEL_LINKS.map((l) => `link:${l}`),
  ]);
  expect(await menuLinks(page)).toEqual(TOP_LEVEL_LINKS);

  /*
   * The original regression: group links used to render inline here,
   * pushing the panel past the screen. Not one of them may be present
   * at the top level. Nor may the old Tools row, or the Markets and
   * Research section anchors whose places the groups took.
   */
  for (const link of GROUPS.flatMap((g) => g.links)) {
    await expect(menu.getByRole("link", { name: link, exact: true })).toHaveCount(0);
  }
  await expect(menu.getByRole("button", { name: "Tools", exact: true })).toHaveCount(0);
  await expect(menu.locator('a[href$="#markets"], a[href$="#research"]')).toHaveCount(0);

  // Client Login was removed from the menu entirely (Sep 2026).
  await expect(menu.getByRole("link", { name: /client login/i })).toHaveCount(0);
  await expect(menu.locator('a[href="/get-started"]')).toHaveCount(0);
});

test("tapping a group drills into that group's view only, and Back returns", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  for (const group of GROUPS) {
    await menu.getByRole("button", { name: group.heading, exact: true }).tap();
    expect(await currentView(page)).toBe(group.view);

    // Exactly this group's links, in order, and nothing else — no other
    // group's links and none of the top-level links.
    expect(await menuLinks(page)).toEqual(group.links);
    // The view names its group, since the row that opened it is gone.
    await expect(page.locator(VIEW)).toContainText(group.heading);
    // No Client Login in this view either — nothing is pinned below it.
    await expect(menu.getByRole("link", { name: /client login/i })).toHaveCount(0);

    // Back returns to the top level.
    await menu.getByRole("button", { name: "Back", exact: true }).tap();
    expect(await currentView(page)).toBe("main");
    expect(await menuLinks(page)).toEqual(TOP_LEVEL_LINKS);
  }
});

test("a group link navigates and closes the menu", async ({ page }, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  await menu.getByRole("button", { name: "Corporate & Events", exact: true }).tap();
  await menu.getByRole("link", { name: "Economic Dashboard", exact: true }).tap();
  await expect(page).toHaveURL(/\/economic-dashboard$/);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
});

test("closing the menu resets the drill-down to the top level", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  await menu.getByRole("button", { name: "Research & News", exact: true }).tap();
  await expect(menu.getByRole("button", { name: "Back", exact: true })).toBeVisible();

  // Close, then reopen — must land on the top level, not stay in the group.
  await page.getByRole("button", { name: "Close menu" }).tap();
  await page.getByRole("button", { name: "Open menu" }).tap();

  await expect(menu.getByRole("button", { name: "Research & News", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

test("the open mobile menu never extends past the viewport", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await openMobileMenu(page);
  const menu = page.locator(MOBILE_MENU);

  /*
   * The actual reported bug, asserted directly: the panel's bottom edge
   * must sit inside the viewport in EVERY view. A drill-down that stays
   * short today is not enough — the scroll container is what keeps this
   * true when a group grows, so it is checked, not assumed.
   */
  for (const step of ["top level", ...GROUPS.map((g) => g.heading)]) {
    if (step !== "top level") {
      await menu.getByRole("button", { name: step, exact: true }).tap();
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
    if (step !== "top level") {
      await menu.getByRole("button", { name: "Back", exact: true }).tap();
    }
  }
});
