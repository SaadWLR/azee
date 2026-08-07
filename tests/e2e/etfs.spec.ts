import { expect, test } from "./fixtures";

/*
 * The /etfs page — every PSX-listed Exchange Traded Fund (sector 0837).
 * Desktop-scoped like the other page specs; the table is
 * viewport-independent.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "ETFs page is viewport-independent; run once on desktop",
  );
});

/*
 * Symbols are asserted as a floor, not an exact set: PSX can list or
 * delist an ETF and this spec must not fail for that. These are the
 * long-standing ones, cross-verified against PSX's own /etf/ URL path.
 */
const KNOWN_ETFS = ["MZNPETF", "UBLPETF", "NITGETF"];

test("etfs page deep-links and lists live PSX ETFs with full price detail", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // Direct URL navigation — proves the SPA rewrite serves this route.
  const response = await page.goto("/etfs");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { level: 1, name: "Exchange Traded Funds" }),
  ).toBeVisible();

  const table = page.locator("main table");
  await expect(table).toBeVisible();

  // Every column ETF investors need, including the three the
  // market-watch endpoint parses and discards.
  for (const col of ["High", "Low", "LDCP", "Current", "Change %", "Volume"]) {
    await expect(table.locator("thead")).toContainText(col);
  }

  // Real ETFs, each with the fund name PSX publishes beside it.
  for (const sym of KNOWN_ETFS) await expect(table).toContainText(sym);
  await expect(table).toContainText("Meezan Pakistan ETF");

  const rows = page.locator("main table tbody tr");
  expect(await rows.count()).toBeGreaterThanOrEqual(5);

  /*
   * Real, self-consistent values: every row's high must be >= its low,
   * and every price must be a positive number — never a zero-filled or
   * placeholder row.
   */
  const cells = await rows.evaluateAll((trs) =>
    trs.map((tr) => {
      const td = [...tr.querySelectorAll("td")].map((c) =>
        c.textContent!.trim(),
      );
      const n = (s: string) => Number.parseFloat(s.replace(/,/g, ""));
      return { symbol: td[0], high: n(td[2]), low: n(td[3]), ldcp: n(td[4]), current: n(td[5]) };
    }),
  );
  for (const c of cells) {
    expect(Number.isFinite(c.current), `${c.symbol} current`).toBe(true);
    expect(c.current, `${c.symbol} current > 0`).toBeGreaterThan(0);
    expect(c.ldcp, `${c.symbol} ldcp > 0`).toBeGreaterThan(0);
    expect(c.high, `${c.symbol} high >= low`).toBeGreaterThanOrEqual(c.low);
  }

  // Mutual funds are a different instrument and must not be implied.
  await expect(page.locator("main")).toContainText(/do not trade on the exchange/i);

  expect(errors).toEqual([]);
});

test("the Footer 'ETFs' link reaches /etfs", async ({ page }) => {
  await page.goto("/");
  const markets = page.getByRole("navigation", { name: "Markets" });

  /*
   * "ETFs" and "Mutual Funds" are separate footer entries. They were
   * one "Mutual Funds & ETFs" link pointing at /etfs, which implied
   * mutual funds were covered when only ETFs were.
   */
  await expect(markets.getByRole("link", { name: "ETFs", exact: true })).toHaveAttribute(
    "href",
    "/etfs",
  );
  await expect(
    markets.getByRole("link", { name: "Mutual Funds", exact: true }),
  ).toHaveAttribute("href", "/mutual-funds");
  // The combined label is gone entirely.
  await expect(
    page.locator("footer").getByText("Mutual Funds & ETFs"),
  ).toHaveCount(0);

  await markets.getByRole("link", { name: "ETFs", exact: true }).click();
  await expect(page).toHaveURL(/\/etfs$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Exchange Traded Funds" }),
  ).toBeVisible();
});

test("mutual funds is a separate, honestly pending page", async ({ page }) => {
  const response = await page.goto("/mutual-funds");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mutual Funds" }),
  ).toBeVisible();

  const main = page.locator("main");
  await expect(main).toContainText("Content pending");
  await expect(main).toContainText(/have not yet confirmed a verified source/i);
  // It must state the distinction it exists to make.
  await expect(main).toContainText(/Mutual funds are not ETFs/i);

  /*
   * Zero fabricated data: no NAV, return or fund figure may appear
   * ahead of the sourcing milestone. Same mechanical scan used for the
   * Economic Dashboard rather than a visual check.
   */
  const text = await main.innerText();
  const numberShaped =
    text.match(/\b\d+(\.\d+)?\s*%|\bRs\.?\s*[\d,]+|\b\d{1,3}(,\d{3})+\b|\b\d+\.\d{2,4}\b/g) ?? [];
  expect(numberShaped, "no figure-shaped text on a pending page").toEqual([]);
});

test("GET /api/market/etfs returns only PSX sector-0837 instruments", async ({
  request,
}) => {
  const response = await request.get("/api/market/etfs");
  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(Array.isArray(body.etfs)).toBe(true);
  expect(body.etfs.length).toBeGreaterThanOrEqual(5);
  expect(body.source).toMatch(/^(psx|cache)$/);

  for (const e of body.etfs) {
    expect(typeof e.symbol).toBe("string");
    expect(typeof e.name).toBe("string");
    for (const field of ["price", "ldcp", "high", "low", "volume"]) {
      expect(Number.isFinite(e[field]), `${e.symbol}.${field}`).toBe(true);
    }
    expect(e.price).toBeGreaterThan(0);
    expect(e.high).toBeGreaterThanOrEqual(e.low);
    expect(["up", "down"]).toContain(e.direction);
    // Change must reconcile against PSX's own previous close.
    const implied = (e.changePoints / e.ldcp) * 100;
    expect(Math.abs(implied - e.changePercent)).toBeLessThanOrEqual(
      Math.max(0.15, Math.abs(e.changePercent) * 0.03),
    );
  }
});
