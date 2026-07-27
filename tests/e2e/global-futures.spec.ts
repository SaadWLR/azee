import { expect, test } from "./fixtures";

/*
 * The "Global Futures" tab on /indices. Desktop-scoped like the other
 * page specs. The existing indices.spec.ts (PSX tab) must keep passing
 * UNMODIFIED — that suite proves the PSX side is untouched; this one
 * only covers the additive futures tab.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Global Futures tab is viewport-independent; run once on desktop",
  );
});

const BENCHMARKS = ["S&P 500", "Nasdaq-100", "Dow Jones", "Japan Equity"];

test("Global Futures tab shows real PMEX futures with honest framing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/indices");
  // PSX is the default tab.
  await expect(
    page.getByRole("tab", { name: "PSX Indices" }),
  ).toHaveAttribute("aria-selected", "true");

  // Switch to Global Futures — URL becomes addressable.
  await page.getByRole("tab", { name: "Global Futures" }).click();
  await expect(page).toHaveURL(/\?tab=global/);
  await expect(
    page.getByRole("tab", { name: "Global Futures" }),
  ).toHaveAttribute("aria-selected", "true");

  const table = page.locator("main table");
  await expect(table).toBeVisible();
  // Four benchmark futures, each present by name plus a real contract.
  await expect(table).toContainText("SP500-SE26");
  await expect(page.locator("main table tbody tr")).toHaveCount(4);
  for (const b of BENCHMARKS) await expect(table).toContainText(b);

  // Honest framing: EVERY row is labelled "PMEX futures", not a spot index.
  expect(
    await page
      .locator("main table tbody tr")
      .filter({ hasText: "PMEX futures" })
      .count(),
  ).toBe(4);

  // Real, sane values in the Bid column.
  const bid = await page
    .locator("main table tbody tr")
    .first()
    .locator("td")
    .nth(2)
    .innerText();
  expect(Number.parseFloat(bid.replace(/,/g, ""))).toBeGreaterThan(1000);

  // The disclaimer states the distinction and PMEX membership plainly.
  await expect(page.locator("main")).toContainText(/not the spot index level/i);
  await expect(page.locator("main")).toContainText(
    /Pakistan Mercantile Exchange/,
  );
  // Never presents a benchmark as its own spot index value.
  expect(await page.locator("main").innerText()).not.toMatch(
    /S&P 500 index\b/i,
  );

  expect(errors).toEqual([]);
});

test("switching back to PSX tab restores the PSX indices table", async ({
  page,
}) => {
  await page.goto("/indices?tab=global");
  await expect(page.locator("main table tbody tr")).toHaveCount(4); // futures

  await page.getByRole("tab", { name: "PSX Indices" }).click();
  await expect(page).toHaveURL(/\/indices$/); // tab param cleared
  // The PSX benchmark indices (expandable rows) are back — 10 of them.
  await expect(
    page.locator('main table tbody tr[role="button"]'),
  ).toHaveCount(10);
});
