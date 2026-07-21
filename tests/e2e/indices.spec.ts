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
