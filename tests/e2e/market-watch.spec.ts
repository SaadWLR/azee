import { expect, test } from "@playwright/test";

/*
 * The Market Watch page is viewport-independent for these functional
 * checks; run once on the desktop project (as api-contracts does) to
 * keep the suite's API footprint low.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Market Watch functional tests are viewport-independent; run once on desktop",
  );
});

const TABLE = "main table";
const ROWS = "main table tbody tr";

/** First data cell (symbol) of each visible row. */
async function symbols(page: import("@playwright/test").Page) {
  return page.locator(`${ROWS} td:first-child`).allInnerTexts();
}

test("loads directly via URL (SPA rewrite) with real PSX data", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // Direct navigation — proves the SPA fallback rewrite serves the app
  // rather than 404ing on a client route.
  await page.goto("/market-watch");
  await expect(page.locator("h1")).toHaveText("Market Watch");
  await expect(page.locator(TABLE)).toBeVisible();

  // Full first page of real symbols (PSX has hundreds; page size 50).
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(20);
  const firstSymbol = (await symbols(page))[0];
  expect(firstSymbol).toMatch(/^[A-Z0-9.\-]{1,12}$/);

  // Real price, not a zero/placeholder.
  const firstPrice = Number.parseFloat(
    (await page.locator(`${ROWS} td:nth-child(2)`).first().innerText()).replace(/,/g, ""),
  );
  expect(firstPrice).toBeGreaterThan(0);

  await page.waitForTimeout(1500);
  expect(consoleErrors).toEqual([]);
});

test("search filters by symbol", async ({ page }) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();
  await page.getByPlaceholder("Search symbol").fill("OGDC");
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(0);
  for (const s of await symbols(page)) expect(s).toContain("OGDC");
});

test("sorting reorders rows", async ({ page }) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();
  // Sort by Price descending, capture the top symbol; toggle to
  // ascending and confirm the top symbol changes.
  const priceHeader = page.getByRole("button", { name: /Price/ });
  await priceHeader.click();
  await page.waitForTimeout(300);
  const topDesc = (await symbols(page))[0];
  await priceHeader.click();
  await page.waitForTimeout(300);
  const topAsc = (await symbols(page))[0];
  expect(topAsc).not.toBe(topDesc);
});

test("quick-filter presets work (Gainers / Losers)", async ({ page }) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();

  await page.getByRole("button", { name: "Gainers", exact: true }).click();
  await page.waitForTimeout(300);
  const gainerChanges = await page
    .locator(`${ROWS} td:nth-child(3)`)
    .allInnerTexts();
  expect(gainerChanges.length).toBeGreaterThan(0);
  for (const c of gainerChanges) expect(c).toContain("▲"); // up arrow only

  await page.getByRole("button", { name: "Losers", exact: true }).click();
  await page.waitForTimeout(300);
  const loserChanges = await page
    .locator(`${ROWS} td:nth-child(3)`)
    .allInnerTexts();
  expect(loserChanges.length).toBeGreaterThan(0);
  for (const c of loserChanges) expect(c).toContain("▼"); // down arrow only
});
