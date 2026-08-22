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

for (const from of ["/market-watch", "/corporate-calendar"]) {
  test(`from ${from}, a Navbar section link navigates home AND scrolls to the section`, async ({
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

    await page.locator('header nav ul a', { hasText: "Research" }).click();

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
   * Uses #trading: "Products" lost its top-level nav slot to Forex, so
   * there is no #products anchor in the bar any more. The section
   * itself is unaffected — that is asserted separately below.
   */
  await page.locator('header nav ul a[href="#trading"]').click();
  await expect
    .poll(async () => Math.abs((await sectionAtTop(page, "trading")).top), {
      timeout: 10_000,
    })
    .toBeLessThan(250);
  expect((await sectionAtTop(page, "trading")).scrollY).toBeGreaterThan(500);
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
