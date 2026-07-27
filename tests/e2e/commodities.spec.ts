import { expect, test } from "./fixtures";

/*
 * The /commodities page — PMEX commodity futures. Desktop-scoped like
 * the other page specs. The existing indices.spec.ts and
 * global-futures.spec.ts must keep passing UNMODIFIED — those suites
 * prove the Indices page is untouched; this one only covers the new
 * additive route.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Commodities page is viewport-independent; run once on desktop",
  );
});

const GROUPS = ["Energy", "Metals", "Agriculture"];

test("commodities page deep-links and shows real PMEX futures grouped by category", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // Direct URL navigation — proves the SPA rewrite serves this route,
  // rather than relying on an in-app click to get here.
  const response = await page.goto("/commodities");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { level: 1, name: "Commodity Futures" }),
  ).toBeVisible();

  const table = page.locator("main table");
  await expect(table).toBeVisible();

  // Every group from the data is rendered as its own section header.
  for (const g of GROUPS) {
    await expect(
      page.locator("main table th[scope='colgroup']", { hasText: g }),
    ).toBeVisible();
  }

  /*
   * Real commodities, with a real contract symbol beside each. Symbols
   * are matched by their base only — expiries roll over, so asserting a
   * full symbol would make this spec expire with the contract.
   */
  await expect(table).toContainText("Crude Oil (WTI)");
  await expect(table).toContainText("Gold");
  await expect(table).toContainText("Wheat");
  await expect(table).toContainText(/CRUDE\d+-/);
  await expect(table).toContainText(/GO\w*OZ-/);

  // Data rows (excluding the three group header rows), all quoted.
  const rows = page.locator("main table tbody tr").filter({ hasText: "PMEX futures" });
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(8);

  // Honest framing: EVERY data row is labelled "PMEX futures" — one
  // label per quoted row, no row presented as a bare commodity price.
  expect(
    await table.getByText("PMEX futures", { exact: true }).count(),
  ).toBe(count);

  // Real, sane values — gold's bid is a four-figure number, not a stub.
  const goldBid = await rows
    .filter({ hasText: "Gold" })
    .first()
    .locator("td")
    .nth(2)
    .innerText();
  expect(Number.parseFloat(goldBid.replace(/,/g, ""))).toBeGreaterThan(100);

  // No fabricated data: every numeric cell is either a real number or
  // an honest em-dash, never "0.00" standing in for missing data.
  const bids = await rows.locator("td:nth-child(3)").allInnerTexts();
  for (const b of bids) {
    expect(b.trim()).not.toBe("0.00");
    expect(b.trim()).toMatch(/^[\d,]+\.\d+$|^—$/);
  }

  expect(errors).toEqual([]);
});

test("commodities page states the futures-not-spot distinction and PMEX membership", async ({
  page,
}) => {
  await page.goto("/commodities");
  const main = page.locator("main");

  await expect(main).toContainText(/not the spot price of the commodity/i);
  await expect(main).toContainText(/Pakistan Mercantile Exchange/);
  await expect(main).toContainText(/futures contracts/i);

  /*
   * The page never PRESENTS the table as spot prices. Checked on the
   * headings rather than the body copy, because the body deliberately
   * uses the phrase "not spot commodity prices" to draw the very
   * distinction being asserted here.
   */
  const headings = await main.getByRole("heading").allInnerTexts();
  expect(headings).toContain("Commodity Futures");
  for (const h of headings) expect(h).not.toMatch(/commodity prices/i);
});

test("Tools dropdown, Footer and the Products tile all reach /commodities", async ({
  page,
}) => {
  // Tools dropdown.
  await page.goto("/");
  await page.getByRole("button", { name: /tools/i }).click();
  await page
    .getByRole("menu", { name: /tools/i })
    .getByRole("menuitem", { name: "Commodities" })
    .click();
  await expect(page).toHaveURL(/\/commodities$/);

  // Footer link — the "PMEX Commodities" label was a dead placeholder
  // before this page existed.
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Markets" })
    .getByRole("link", { name: "PMEX Commodities" })
    .click();
  await expect(page).toHaveURL(/\/commodities$/);

  // Products section tile — same previously-dead reference.
  await page.goto("/");
  await page
    .locator("#products")
    .getByRole("link")
    .filter({ hasText: "PMEX Commodities" })
    .click();
  await expect(page).toHaveURL(/\/commodities$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Commodity Futures" }),
  ).toBeVisible();
});
