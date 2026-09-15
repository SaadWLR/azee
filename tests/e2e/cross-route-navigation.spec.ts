import { expect, test } from "./fixtures";

/*
 * Guards the cross-route → homepage-section navigation path that
 * regressed unnoticed when the Navbar became route-aware. Desktop-
 * scoped like the other functional specs to manage the suite's known
 * rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Navigation behavior is viewport-independent; run once on desktop",
  );
});

/** Is the section with this id scrolled to (near) the viewport top? */
async function sectionAtTop(page: import("@playwright/test").Page, id: string) {
  return page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return { found: false, top: NaN, scrollY: window.scrollY };
    const top = el.getBoundingClientRect().top;
    return { found: true, top: Math.round(top), scrollY: Math.round(window.scrollY) };
  }, id);
}

/*
 * The Navbar has no section links left (Sep 2026): Trading was removed
 * and About became the /about route, after Products, Markets and
 * Research had already lost theirs. The in-app cross-route link to a
 * homepage section that remains is Knowledge Centre's "View Research →"
 * (to="/#research"), so that is what keeps this path covered now.
 */
for (const from of ["/knowledge-centre"]) {
  test(`from ${from}, a link to a homepage section navigates home AND scrolls to it`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await page.goto(from);
    await expect(page.locator("h1")).toBeVisible();

    // Marker proves the click is CLIENT-SIDE routing (it would be
    // wiped by a full page reload, the old <a href="/#..."> behavior).
    await page.evaluate(() => {
      (window as unknown as { __noReload?: number }).__noReload = 1;
    });

    await page.locator('main a[href="/#research"]', { hasText: "View Research" }).click();

    // Navigated to home with the hash...
    await expect(page).toHaveURL(/\/#research$/);
    // ...client-side (marker survived)...
    const marker = await page.evaluate(
      () => (window as unknown as { __noReload?: number }).__noReload,
    );
    expect(marker).toBe(1);

    // ...and genuinely scrolled to the section. Poll on the LANDING
    // condition itself (element near viewport top) — polling scrollY
    // alone succeeds mid-animation and then measures a scroll still
    // in flight.
    await expect
      .poll(async () => Math.abs((await sectionAtTop(page, "research")).top), {
        timeout: 10_000,
      })
      .toBeLessThan(250);
    const pos = await sectionAtTop(page, "research");
    expect(pos.found).toBe(true);
    expect(pos.scrollY).toBeGreaterThan(500);

    expect(consoleErrors).toEqual([]);
  });
}

test("same-page anchors on the homepage still work (no regression)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  /*
   * Uses the hero's "View Research" button (href="#research"): the bar
   * has no section anchors left to click, but the homepage still links
   * within itself, and ScrollToHash must not fight the browser's native
   * handling of it.
   */
  await page.locator('#markets a[href="#research"]', { hasText: "View Research" }).click();
  await expect
    .poll(async () => Math.abs((await sectionAtTop(page, "research")).top), {
      timeout: 10_000,
    })
    .toBeLessThan(250);
  expect((await sectionAtTop(page, "research")).scrollY).toBeGreaterThan(500);
});

test("Products section survives losing its nav link", async ({ page }) => {
  await page.goto("/");
  // The nav slot is gone...
  await expect(page.locator('header nav ul a[href="#products"]')).toHaveCount(0);
  await expect(
    page.locator("header nav ul").getByRole("link", { name: "Forex & Commodities" }),
  ).toBeVisible();

  // ...but the section itself still renders, in full.
  const products = page.locator("#products");
  await expect(products).toBeAttached();
  await expect(products).toContainText("Every market,");
  await expect(products).toContainText("one relationship.");
  /*
   * The section is now a canvas list rather than a six-tile grid, so
   * the anchor count changed and that is deliberate: the old grid gave
   * all six an <a>, four of them dead href="#" placeholders. Only the
   * two services with a real page are links now; the rest are inert
   * rather than pretending. What must hold is that all six services
   * are still present with their real copy.
   */
  await expect(products.locator('a[href="/commodities"]')).toHaveCount(1);
  await expect(products.locator('a[href="/mutual-funds"]')).toHaveCount(1);
  await expect(
    products.locator('a[href="#"]'),
    "no dead placeholder anchors remain",
  ).toHaveCount(0);
  for (const title of [
    "Equity Trading",
    "PMEX Commodities",
    "IPO Investment",
    "Mutual Funds",
    "Market Research",
    "Portfolio Advisory",
  ]) {
    await expect(products).toContainText(title);
  }
  // And it is still reachable by direct hash navigation.
  await page.goto("/#products");
  await expect
    .poll(async () => Math.abs((await sectionAtTop(page, "products")).top), {
      timeout: 10_000,
    })
    .toBeLessThan(250);
});

test("Markets, About, Research and Trading sections survive losing their nav links", async ({
  page,
}) => {
  await page.goto("/");
  /*
   * Markets' and Research's bar slots went to the dropdowns of the same
   * names; Trading was removed; About now opens the /about page. All
   * four homepage sections were deliberately left alone: still
   * rendered, still reachable by scrolling (and /#research by direct
   * hash navigation, the next test).
   */
  await expect(page.locator('header a[href^="#"], header a[href*="/#"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Markets", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Research & News", exact: true })).toBeVisible();
  await expect(
    page.locator("header nav ul").getByRole("link", { name: "About", exact: true }),
  ).toHaveAttribute("href", "/about");

  for (const id of ["markets", "about", "research", "trading"]) {
    const section = page.locator(`#${id}`);
    await expect(section).toBeAttached();
    // Reachable by scroll: bring it into view the way a reader would
    // reach it, and it is on screen with real height.
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeInViewport();
    expect((await section.boundingBox())!.height).toBeGreaterThan(300);
  }
});

test("direct navigation to /#research loads home scrolled to the section", async ({
  page,
}) => {
  await page.goto("/#research");
  await expect
    .poll(async () => Math.abs((await sectionAtTop(page, "research")).top), {
      timeout: 10_000,
    })
    .toBeLessThan(250);
  const pos = await sectionAtTop(page, "research");
  expect(pos.found).toBe(true);
  expect(pos.scrollY).toBeGreaterThan(500);
});
