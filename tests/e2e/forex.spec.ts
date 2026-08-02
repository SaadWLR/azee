import { expect, test } from "./fixtures";

/*
 * The /forex page — mid-market PKR reference rates. Desktop-scoped like
 * the other page specs; the table is viewport-independent.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Forex page is viewport-independent; run once on desktop",
  );
});

const TARGETS = ["USD", "GBP", "EUR", "AED", "SAR", "AUD", "CAD", "JPY"];
const ROWS = "main table tbody tr";

test("forex page deep-links and shows all eight PKR rates", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const response = await page.goto("/forex");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { level: 1, name: "PKR Exchange Rates" }),
  ).toBeVisible();

  const table = page.locator("main table");
  await expect(table).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(TARGETS.length);
  for (const code of TARGETS) await expect(table).toContainText(code);

  // Real, sane values — USD/PKR is a three-figure number, JPY is ~1.7.
  const cells = await page.locator(ROWS).evaluateAll((trs) =>
    trs.map((tr) => {
      const td = [...tr.querySelectorAll("td")].map((c) => c.textContent!.trim());
      return { code: td[1], rate: Number.parseFloat(td[2].replace(/,/g, "")) };
    }),
  );
  for (const c of cells) {
    expect(Number.isFinite(c.rate), `${c.code} rate parses`).toBe(true);
    expect(c.rate, `${c.code} > 0`).toBeGreaterThan(0);
  }
  const usd = cells.find((c) => c.code === "USD")!;
  expect(usd.rate).toBeGreaterThan(150);
  expect(usd.rate).toBeLessThan(500);

  expect(errors).toEqual([]);
});

test("framing is explicitly mid-market, never a counter rate", async ({
  page,
}) => {
  await page.goto("/forex");
  const main = page.locator("main");

  await expect(main).toContainText(/mid-market reference rates?/i);
  await expect(main).toContainText(/not open-market or money changer rates/i);
  await expect(main).toContainText(/will quote a different rate/i);
  // Attribution is a condition of the source's open-endpoint terms.
  await expect(main).toContainText(/ExchangeRate-API/);

  /*
   * The source publishes a single mid rate, so the page must never
   * present a spread — no buy/sell columns anywhere.
   */
  const headers = await page.locator("main table thead th").allInnerTexts();
  for (const h of headers) {
    expect(h).not.toMatch(/\b(buy|sell|bid|ask)\b/i);
  }
});

test("the displayed timestamp is the source's own, not our fetch time", async ({
  page,
}) => {
  /*
   * This is the exact test that disqualified three candidate sources
   * during research, now applied to our own build: load the page twice,
   * minutes apart, and confirm the displayed publication time does NOT
   * advance while the once-daily source has not actually republished.
   * A timestamp that moved on every load would be a fabricated
   * freshness claim.
   */
  const stamp = async () => {
    await page.goto("/forex");
    await expect(page.locator(ROWS).first()).toBeVisible();
    const text = await page.locator("main").innerText();
    return /Rates published by the source:\s*([^\n·]+)/.exec(text)?.[1]?.trim();
  };

  const first = await stamp();
  expect(first, "a source timestamp is displayed").toBeTruthy();
  // It must be a real formatted date, not "just now" style wording.
  expect(first).toMatch(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2} PKT/);

  await page.waitForTimeout(5000);
  const second = await stamp();
  expect(second, "timestamp is stable across loads").toBe(first);
});

test("Forex is a top-level nav link and Products left the bar", async ({
  page,
}) => {
  await page.goto("/");
  const navBar = page.locator("header nav ul").first();
  await expect(navBar.getByRole("link", { name: "Forex" })).toBeVisible();
  await expect(page.locator('header nav ul a[href="#products"]')).toHaveCount(0);

  await navBar.getByRole("link", { name: "Forex" }).click();
  await expect(page).toHaveURL(/\/forex$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "PKR Exchange Rates" }),
  ).toBeVisible();
});

test("GET /api/market/forex returns eight rates and a real source timestamp", async ({
  request,
}) => {
  const response = await request.get("/api/market/forex");
  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(Array.isArray(body.rates)).toBe(true);
  expect(body.rates.length).toBe(TARGETS.length);
  expect(body.rates.map((r: { code: string }) => r.code).sort()).toEqual(
    [...TARGETS].sort(),
  );
  expect(body.source).toMatch(/^(er-api|cache)$/);
  expect(body.attribution).toContain("ExchangeRate-API");

  // The source's own timestamp must be present and parseable.
  expect(Number.isNaN(Date.parse(body.sourceUpdatedAt))).toBe(false);
  // ...and must NOT be "now" — this source publishes once daily, so a
  // timestamp within seconds of the request would mean we stamped it.
  const ageMs = Date.now() - Date.parse(body.sourceUpdatedAt);
  expect(ageMs, "source timestamp is not our request time").toBeGreaterThan(
    60_000,
  );

  for (const r of body.rates) {
    expect(Number.isFinite(r.pkrPerUnit)).toBe(true);
    expect(r.pkrPerUnit).toBeGreaterThan(0);
    // No spread fields: the source has none, so we must not invent any.
    expect(r).not.toHaveProperty("bid");
    expect(r).not.toHaveProperty("ask");
    expect(r).not.toHaveProperty("buy");
    expect(r).not.toHaveProperty("sell");
  }
});
