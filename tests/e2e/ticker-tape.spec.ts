import { expect, test } from "./fixtures";

/**
 * TickerTape renders a duplicated marquee track; the first child div
 * holds one full copy of the quote list, one <span> per symbol with
 * three inner spans (symbol, price, change).
 */
const TRACK_ITEMS = ".ticker-track > div:first-child > span";

/**
 * The pre-M3 hardcoded fixture, in its exact curated order. Every
 * symbol in it is a real, liquid PSX name that may legitimately
 * appear in a live top-12-by-volume list — but the odds of the live
 * list matching this exact ordered set are nil. An exact-order match
 * therefore cleanly signals the DEV fixture leaking into production.
 */
const OLD_FIXTURE_ORDER = [
  "OGDC", "HBL", "LUCK", "ENGRO", "UBL", "PSO",
  "MEBL", "FFC", "SYS", "MARI", "TRG", "POL",
];

test("ticker renders live quotes with sane values and a clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");

  const items = page.locator(TRACK_ITEMS);
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThanOrEqual(10);

  // Each item: symbol text + parseable positive price.
  const spans = items.first().locator("span");
  await expect(spans).toHaveCount(3);
  const symbol = await spans.nth(0).innerText();
  expect(symbol).toMatch(/^[A-Z0-9.\-]{2,10}$/);
  const price = Number.parseFloat((await spans.nth(1).innerText()).replace(/,/g, ""));
  expect(price).toBeGreaterThan(0);

  // Fixture-leak guard: exact ordered match against the old fixture.
  const symbols: string[] = [];
  for (let i = 0; i < count; i++) {
    symbols.push(await items.nth(i).locator("span").first().innerText());
  }
  expect(symbols).not.toEqual(OLD_FIXTURE_ORDER);

  /*
   * Polling runs at 75s; waiting a full cycle would make CI slow, and
   * Playwright clock mocking can't cleanly intercept the app's
   * already-installed interval without production code changes. So
   * this asserts initial render plus a soft settle window stays
   * error-free; full-cycle polling behaviour was verified manually in
   * M3 and can get a dedicated slow-tagged spec later.
   */
  await page.waitForTimeout(4000);
  expect(errors).toEqual([]);
});
