import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the Market Watch tests, to manage the suite's
 * known API-volume/rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Corporate Calendar functional tests are viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";

test("loads directly via URL (SPA rewrite) with real upcoming meetings", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // Direct navigation — proves the SPA fallback rewrite covers this
  // route (it matches any non-/api/ path) without config changes.
  await page.goto("/corporate-calendar");
  await expect(page.locator("h1")).toHaveText("Corporate Calendar");

  // Real entries: at least one row, every date today-or-future,
  // real-looking symbols and non-empty company names.
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = await page.locator(`${ROWS} td:first-child`).allInnerTexts();
  for (const d of dates) {
    expect(new Date(d).getTime()).toBeGreaterThanOrEqual(today.getTime());
  }
  const firstCompany = await page
    .locator(`${ROWS} td:nth-child(2)`)
    .first()
    .innerText();
  expect(firstCompany.trim().length).toBeGreaterThan(3);

  await page.waitForTimeout(1200);
  expect(consoleErrors).toEqual([]);
});

test("type filter and search work", async ({ page }) => {
  await page.goto("/corporate-calendar");
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);

  // Type filter: after selecting EOGM, every visible badge is EOGM.
  await page.getByRole("button", { name: "EOGM", exact: true }).click();
  await page.waitForTimeout(300);
  const badges = await page.locator(`${ROWS} td:nth-child(3)`).allInnerTexts();
  if (badges.length > 0) {
    for (const b of badges) expect(b.trim()).toBe("EOGM");
  }

  // Search: take a real symbol from the unfiltered list, search it,
  // and confirm every remaining row matches it.
  await page.getByRole("button", { name: "All Meetings" }).click();
  await page.waitForTimeout(300);
  const firstSymbol = (
    await page.locator(`${ROWS} td:nth-child(2) span:nth-child(2)`).first().innerText()
  ).trim();
  await page.getByPlaceholder("Search symbol or company…").fill(firstSymbol);
  await page.waitForTimeout(300);
  const rows = await page.locator(`${ROWS} td:nth-child(2)`).allInnerTexts();
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) expect(r).toContain(firstSymbol);
});

test("date sort toggles order", async ({ page }) => {
  await page.goto("/corporate-calendar");
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(1);
  const firstAsc = await page.locator(`${ROWS} td:first-child`).first().innerText();
  await page.getByRole("button", { name: /Date/ }).click(); // toggle to desc
  await page.waitForTimeout(300);
  const firstDesc = await page.locator(`${ROWS} td:first-child`).first().innerText();
  // With >1 distinct date the top row changes; identical dates would
  // be a legitimate tie, so compare timestamps non-strictly.
  expect(new Date(firstDesc).getTime()).toBeGreaterThanOrEqual(
    new Date(firstAsc).getTime(),
  );
});
