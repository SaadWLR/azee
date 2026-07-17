import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the Corporate Calendar and Market Watch tests,
 * to manage the suite's known API-volume/rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Payouts functional tests are viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";
const ANNOUNCEMENT = `${ROWS} td:nth-child(3)`;

/** PSX's own notation: every payout carries a (D), (B) or (R) code. */
const PSX_CODE = /\((D|B|R)\)/;

test("payouts tab loads directly via ?tab=payouts with real announcements", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto("/corporate-calendar?tab=payouts");
  await expect(page.locator("h1")).toHaveText("Corporate Calendar");
  await expect(page.getByRole("tab", { name: "Payouts" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);

  // The announcement column shows PSX's verbatim string, not a
  // reformatted one — every row still carries the raw instrument code.
  const announcements = await page.locator(ANNOUNCEMENT).allInnerTexts();
  for (const a of announcements) {
    expect(a.trim()).toMatch(PSX_CODE);
  }

  // Announcements are historical, so dates must be today-or-past —
  // the mirror of the meetings view's today-or-future assertion.
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dates = await page.locator(`${ROWS} td:first-child`).allInnerTexts();
  for (const d of dates) {
    expect(new Date(d).getTime()).toBeLessThan(tomorrow.getTime());
  }

  await page.waitForTimeout(1200);
  expect(consoleErrors).toEqual([]);
});

test("meetings is the default tab and switching between tabs works", async ({
  page,
}) => {
  await page.goto("/corporate-calendar");

  // Default is unchanged: Meetings, with its own filter controls.
  await expect(page.getByRole("tab", { name: "Meetings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "All Meetings" })).toBeVisible();
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Payouts" }).click();
  await expect(page.getByRole("button", { name: "All Payouts" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("payouts");

  // Back to Meetings: the tab param drops off rather than lingering
  // as ?tab=meetings, keeping the canonical URL clean.
  await page.getByRole("tab", { name: "Meetings" }).click();
  await expect(page.getByRole("button", { name: "All Meetings" })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("tab")).toBe(false);
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);
});

test("kind filter and search work", async ({ page }) => {
  await page.goto("/corporate-calendar?tab=payouts");
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(0);

  // Dividends are the overwhelming majority of PSX payouts, so this
  // filter reliably has rows; each remaining row must be tagged
  // Dividend, and a row may carry several tags (compound payouts).
  await page.getByRole("button", { name: "Dividend" }).click();
  await page.waitForTimeout(300);
  const rowCount = await page.locator(ROWS).count();
  expect(rowCount).toBeGreaterThan(0);
  for (let i = 0; i < rowCount; i++) {
    const types = await page.locator(`${ROWS} td:nth-child(4)`).nth(i).innerText();
    expect(types).toContain("Dividend");
  }

  // Search: take a real symbol from the unfiltered list, search it,
  // and confirm every remaining row matches it.
  await page.getByRole("button", { name: "All Payouts" }).click();
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

test("payouts default to newest first and the sort toggles", async ({ page }) => {
  await page.goto("/corporate-calendar?tab=payouts");
  await expect.poll(async () => page.locator(ROWS).count()).toBeGreaterThan(1);

  // Default order: descending by announcement date, top row newest.
  const dates = (await page.locator(`${ROWS} td:first-child`).allInnerTexts()).map(
    (d) => new Date(d).getTime(),
  );
  for (let i = 1; i < dates.length; i++) {
    expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
  }

  await page.getByRole("button", { name: /Announced/ }).click(); // toggle to asc
  await page.waitForTimeout(300);
  const asc = (await page.locator(`${ROWS} td:first-child`).allInnerTexts()).map((d) =>
    new Date(d).getTime(),
  );
  for (let i = 1; i < asc.length; i++) {
    expect(asc[i]).toBeGreaterThanOrEqual(asc[i - 1]);
  }
  expect(asc[0]).toBeLessThanOrEqual(dates[0]);
});
