import { expect, test } from "./fixtures";

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

type Page = import("@playwright/test").Page;

/**
 * First data cell of each visible row. Since company names landed, this
 * cell holds the ticker, any index badge AND the company name — use it
 * for "contains" checks, and tickers() below when the bare ticker is
 * what's being asserted.
 */
async function symbols(page: Page) {
  return page.locator(`${ROWS} td:first-child`).allInnerTexts();
}

/** Just the ticker text — the first span inside the symbol cell. */
async function tickers(page: Page) {
  return page
    .locator(`${ROWS} td:first-child span span:first-child`)
    .allInnerTexts();
}

/**
 * Every cell under the column with this header, located BY HEADER TEXT
 * rather than a hardcoded nth-child. Adding the Sector column shifted
 * Price from child 2 to 3 and Change % from 3 to 4 and silently broke
 * the old positional assertions; resolving the index at runtime means
 * the next column added cannot do the same.
 */
async function cellsUnder(page: Page, header: string) {
  const headers = await page.locator(`${TABLE} thead th`).allInnerTexts();
  const index = headers.findIndex((h) => h.trim().startsWith(header));
  if (index < 0) throw new Error(`No "${header}" column: saw ${headers.join(" | ")}`);
  return page.locator(`${ROWS} td:nth-child(${index + 1})`).allInnerTexts();
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
  // The ticker itself is still a bare ticker — asserted on the ticker
  // element, since the cell around it now also carries the company name.
  const firstTicker = (await tickers(page))[0];
  expect(firstTicker).toMatch(/^[A-Z0-9.\-]{1,12}$/);

  // Real price, not a zero/placeholder.
  const firstPrice = Number.parseFloat(
    (await cellsUnder(page, "Price"))[0].replace(/,/g, ""),
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

test("rows carry real PSX company names and sector names", async ({ page }) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(20);

  /*
   * Names and sectors are a second fetch joined by ticker server-side.
   * The floor is deliberately well under 100%: the directory legitimately
   * does not cover every quoted symbol, and an unmatched row must keep
   * its bare ticker rather than be dropped or given a made-up name. A
   * collapse to near-zero, though, means the join or the directory broke.
   */
  const sectors = await cellsUnder(page, "Sector");
  const named = sectors.filter((s) => s.trim() && s.trim() !== "—");
  expect(named.length / sectors.length).toBeGreaterThan(0.8);

  // Sectors are real PSX classifications, not codes leaking through.
  for (const s of named) expect(s).not.toMatch(/^\d+$/);
  // More than one distinct sector — a single repeated value would mean
  // the join is mapping every row to the same entry.
  expect(new Set(named).size).toBeGreaterThan(3);

  // A known large-cap resolves to its real published name.
  await page.getByPlaceholder("Search symbol").fill("OGDC");
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(0);
  const ogdc = (await symbols(page))[0];
  expect(ogdc).toContain("OGDC");
  expect(ogdc.toUpperCase()).toContain("OIL");
});

test("search matches company name and sector, not just ticker", async ({
  page,
}) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(20);

  // A sector term matches rows whose TICKER does not contain it —
  // proving the filter reads the joined fields, not just the symbol.
  await page.getByPlaceholder("Search symbol").fill("CEMENT");
  await expect.poll(async () => (await symbols(page)).length).toBeGreaterThan(0);
  const sectors = await cellsUnder(page, "Sector");
  for (const s of sectors) expect(s.toUpperCase()).toContain("CEMENT");
  const matched = await tickers(page);
  expect(matched.some((t) => !t.toUpperCase().includes("CEMENT"))).toBe(true);
});

test("GET /api/market/watch carries names/sectors without dropping rows", async ({
  request,
}) => {
  const response = await request.get("/api/market/watch");
  expect(response.status()).toBe(200);
  const body = await response.json();

  // The row floor is unchanged by the join: enrichment must never cost
  // a quote. (MIN_VALID_ROWS in api/market/psx-watch.ts is 50.)
  expect(body.quotes.length).toBeGreaterThan(400);

  const withName = body.quotes.filter((q: { name?: string }) => q.name);
  const withSector = body.quotes.filter((q: { sector?: string }) => q.sector);
  expect(withName.length / body.quotes.length).toBeGreaterThan(0.8);
  expect(withSector.length / body.quotes.length).toBeGreaterThan(0.8);

  for (const q of withName) {
    expect(typeof q.name).toBe("string");
    expect(q.name.length).toBeGreaterThan(0);
    // The name must not merely echo the ticker — that would mean the
    // join fell back to fabricating a "name" from the symbol.
    expect(q.name).not.toBe(q.symbol);
  }
  // Every quote still has its symbol and a real price regardless of
  // whether the directory covered it.
  for (const q of body.quotes) {
    expect(typeof q.symbol).toBe("string");
    expect(q.price).toBeGreaterThan(0);
  }
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

test("KMI-30 filter shows only Islamic-index constituents with badges + note", async ({
  page,
}) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();

  // The methodology note must be genuinely rendered (not just coded),
  // and must not phrase membership as a religious ruling. Scoped to the
  // Market Watch section so the guard targets the feature's own copy
  // (membership is framed as KMI-30 index membership, never "Halal").
  const watchSection = page.locator("section:has(table)");
  const note = page.getByText(/statement of index membership/i);
  await expect(note).toBeVisible();
  await expect(note).toContainText("not individual religious advice");
  await expect(watchSection).not.toContainText("Halal");

  await page.getByRole("button", { name: "KMI-30", exact: true }).click();
  await page.waitForTimeout(400);

  // Plausible index size (~30 constituents) and every visible row badged.
  const count = await page.locator(ROWS).count();
  expect(count).toBeGreaterThanOrEqual(25);
  expect(count).toBeLessThanOrEqual(35);
  const badges = await page.locator(`${ROWS} td:first-child`).allInnerTexts();
  for (const cell of badges) expect(cell).toContain("KMI-30");

  const visible = await tickers(page);
  for (const inc of ["MEBL", "OGDC", "LUCK", "MARI", "SYS"]) {
    expect(visible).toContain(inc);
  }
  for (const exc of ["HBL", "UBL", "MCB", "BAFL", "NBP", "ABL"]) {
    expect(visible).not.toContain(exc);
  }
});

test("quick-filter presets work (Gainers / Losers)", async ({ page }) => {
  await page.goto("/market-watch");
  await expect(page.locator(TABLE)).toBeVisible();

  await page.getByRole("button", { name: "Gainers", exact: true }).click();
  await page.waitForTimeout(300);
  const gainerChanges = await cellsUnder(page, "Change %");
  expect(gainerChanges.length).toBeGreaterThan(0);
  for (const c of gainerChanges) expect(c).toContain("▲"); // up arrow only

  await page.getByRole("button", { name: "Losers", exact: true }).click();
  await page.waitForTimeout(300);
  const loserChanges = await cellsUnder(page, "Change %");
  expect(loserChanges.length).toBeGreaterThan(0);
  for (const c of loserChanges) expect(c).toContain("▼"); // down arrow only
});
