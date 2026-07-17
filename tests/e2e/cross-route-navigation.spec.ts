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
  await page.locator('header nav ul a[href="#products"]').click();
  await expect
    .poll(async () => Math.abs((await sectionAtTop(page, "products")).top), {
      timeout: 10_000,
    })
    .toBeLessThan(250);
  expect((await sectionAtTop(page, "products")).scrollY).toBeGreaterThan(500);
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
