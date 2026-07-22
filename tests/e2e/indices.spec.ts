import { expect, test } from "./fixtures";

/*
 * The Indices page is viewport-independent for these functional checks;
 * run once on the desktop project (as Market Watch / api-contracts do)
 * to keep the suite's API footprint low.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Indices functional tests are viewport-independent; run once on desktop",
  );
});

const TABLE = "main table";
const ROWS = "main table tbody tr";

/** The 10 PSX benchmark indices, by code — the full expected set. */
const EXPECTED_CODES = [
  "KSE100",
  "KSE30",
  "ALLSHR",
  "KMI30",
  "KMIALLSHR",
  "PSXDIV20",
  "BKTI",
  "OGTI",
  "UPP9",
  "NITPGI",
];

test("loads directly via URL (SPA rewrite) with all 10 real indices", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // Deep-link straight to /indices — proves the SPA-fallback rewrite
  // covers this route too (not just a client-side navigation to it).
  await page.goto("/indices");
  await expect(page.locator("h1")).toHaveText("Indices");
  await expect(page.locator(TABLE)).toBeVisible();

  // All 10 benchmark indices render, each by code AND full name.
  await expect(page.locator(ROWS)).toHaveCount(10);
  const table = page.locator(TABLE);
  for (const code of EXPECTED_CODES) {
    await expect(table).toContainText(code);
  }
  await expect(table).toContainText("KSE-100 Index");
  await expect(table).toContainText("NIT Pakistan Gateway Index");

  // Values are real and sane: every "Current" cell parses to a positive
  // number in a plausible index range (not 0, not a fabricated blank).
  const currents = await page
    .locator(`${ROWS} td:nth-child(2)`)
    .allInnerTexts();
  expect(currents).toHaveLength(10);
  for (const text of currents) {
    const n = Number.parseFloat(text.replace(/,/g, ""));
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThan(1000);
    expect(n).toBeLessThan(10_000_000);
  }

  // No "Value"/turnover column — PSX exposes no such metric, and it must
  // not be faked as a header or placeholder cell.
  const headers = (await page.locator("main thead").innerText()).toLowerCase();
  expect(headers).toContain("volume");
  expect(headers).not.toContain("value");
  expect(headers).not.toContain("turnover");

  expect(errors).toEqual([]);
});

test("column sort reorders the rows", async ({ page }) => {
  await page.goto("/indices");
  await expect(page.locator(ROWS)).toHaveCount(10);

  const codes = () => page.locator(`${ROWS} td:first-child`).allInnerTexts();
  const before = await codes();

  // Sort by Current ascending, then read the value column and confirm
  // it is genuinely non-decreasing (i.e. the click actually sorted).
  await page.getByRole("button", { name: /^Current/ }).click(); // desc first
  await page.getByRole("button", { name: /^Current/ }).click(); // toggle to asc
  const after = await codes();
  expect(after).not.toEqual(before);

  const values = (
    await page.locator(`${ROWS} td:nth-child(2)`).allInnerTexts()
  ).map((t) => Number.parseFloat(t.replace(/,/g, "")));
  const sorted = [...values].sort((a, b) => a - b);
  expect(values).toEqual(sorted);
});

/** The index row whose code cell is EXACTLY `code` (so "ALLSHR" never
 *  also matches "KMIALLSHR"). */
function indexRow(page: import("@playwright/test").Page, code: string) {
  return page
    .locator('main table tbody tr[role="button"]')
    .filter({ has: page.getByText(code, { exact: true }) });
}

const SUBTABLE = "main table tbody td[colspan] table";

test("expands a small index (OGTI) to its real constituents, and collapses", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/indices");
  const row = indexRow(page, "OGTI");
  await expect(row).toHaveCount(1);
  await row.click();

  // On-demand constituents render: OGTI is a 3-stock index, with real
  // company names (not symbols alone, not fabricated).
  const sub = page.locator(SUBTABLE);
  await expect(sub).toBeVisible();
  await expect(sub.locator("tbody tr")).toHaveCount(3);
  await expect(sub).toContainText("Oil & Gas Development Company Limited");
  // Compact view includes the drill-down-unique Weight % column.
  expect((await sub.locator("thead").innerText()).toLowerCase()).toContain(
    "weight",
  );

  // Collapsing removes the panel cleanly.
  await row.click();
  await expect(page.locator(SUBTABLE)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("expands the largest index (ALLSHR) without breaking layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/indices");
  await indexRow(page, "ALLSHR").click();

  const sub = page.locator(SUBTABLE);
  await expect(sub).toBeVisible();
  // Hundreds of real constituents (ALLSHR ~550).
  expect(await sub.locator("tbody tr").count()).toBeGreaterThan(300);

  // The list is bounded in a fixed-height scroll container: it genuinely
  // scrolls (scrollHeight exceeds the clamped clientHeight), so it can
  // never push the page into an unbounded-height expansion.
  const metrics = await page
    .locator("main table tbody td[colspan] .max-h-96")
    .evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      maxH: getComputedStyle(el).maxHeight,
    }));
  expect(metrics.maxH).toBe("384px");
  expect(metrics.clientH).toBeLessThanOrEqual(384);
  expect(metrics.scrollH).toBeGreaterThan(metrics.clientH);

  // No horizontal page overflow from the wide sub-table.
  const overflow = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);

  expect(errors).toEqual([]);
});
