import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/*
 * Symbol, Sector and Shariah-compliant filters on /announcements.
 *
 * Its own file so the Milestone 1 specs — announcements.spec.ts and
 * announcements-filters.spec.ts — stay untouched.
 *
 * The sector and KMI assertions are checked against the SAME live
 * Market Watch feed the page filters by, fetched independently here.
 * Hardcoding "these symbols are banks" would test a list, not the
 * filter, and would rot the moment PSX reclassified anything.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Announcement filters are viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";
const DISCLAIMER = /Showing matches from the most recent 100 PSX filings/;

interface Quote {
  symbol: string;
  name?: string;
  sector?: string;
  isKmi30?: boolean;
  isKmiAllShare?: boolean;
}

/*
 * Both helpers fetch from INSIDE the page rather than via
 * page.request. The rate-limit bypass in fixtures.ts is installed with
 * context.route, which only intercepts page-initiated requests — an
 * APIRequestContext call would skip the header and could come back 429
 * under the suite's own volume, failing for a reason unrelated to the
 * filter being tested.
 */

/** The live Market Watch feed — the page's own source for sector/KMI. */
async function marketWatch(page: Page): Promise<Map<string, Quote>> {
  const quotes = await page.evaluate(async () => {
    const res = await fetch("/api/market/watch", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`market watch responded ${res.status}`);
    return (await res.json()).quotes as Quote[];
  });
  const map = new Map<string, Quote>();
  for (const q of quotes) map.set(q.symbol, q);
  return map;
}

/** Symbols in the most recent batch of filings, newest first. */
async function recentBatchSymbols(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const res = await fetch("/api/announcements/latest?count=100&offset=0", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`announcements responded ${res.status}`);
    const body = await res.json();
    return body.announcements.map((a: { symbol: string }) => a.symbol) as string[];
  });
}

async function visibleRows(page: Page) {
  return page.locator(ROWS).evaluateAll((trs) =>
    trs.map((tr) => {
      const td = [...tr.querySelectorAll("td")].map((c) => c.textContent!.trim());
      return { date: td[0], symbol: td[2], company: td[3] };
    }),
  );
}

test("symbol autocomplete narrows to one company, with a real total", async ({
  page,
}) => {
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();

  // getByLabel, not getByRole("combobox") — a <select> carries that role
  // too, so the sector dropdown would make the locator ambiguous.
  const symbolBox = page.getByLabel("Filter by symbol");
  await symbolBox.fill("OGDC");

  const option = page.getByRole("option", { name: /OGDC/ }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL(/[?&]symbol=OGDC/);
  await expect(page.locator(ROWS).first()).toBeVisible();

  const rows = await visibleRows(page);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.symbol, `row ${row.symbol}`).toBe("OGDC");
  }

  /*
   * symbol= is PSX's own field and its total is the company's real
   * filing count — 729 when probed, walkable back to 2005 — so the
   * pager says "of N" like any other PSX-side filter. Asserted as a
   * floor, since the number grows as OGDC keeps filing.
   */
  const text = await page.locator("main").innerText();
  const total = Number(/of ([\d,]+) announcements/.exec(text)?.[1].replace(/,/g, ""));
  expect(total).toBeGreaterThan(100);
  await expect(page.locator("main")).not.toContainText(DISCLAIMER);
});

test("selecting a symbol disables sector and Shariah, clearing re-enables", async ({
  page,
}) => {
  await page.goto("/announcements");

  const sector = page.getByLabel("Sector");
  const shariah = page.getByLabel("Shariah-compliant (KMI)");
  await expect(sector).toBeEnabled();
  await expect(shariah).toBeEnabled();

  await page.goto("/announcements?symbol=OGDC");
  await expect(page.getByLabel("Sector")).toBeDisabled();
  await expect(page.getByLabel("Shariah-compliant (KMI)")).toBeDisabled();
  // Matched without the apostrophe: the page renders a straight quote.
  await expect(page.locator("main")).toContainText(
    "apply to a single company",
  );

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/[?&]symbol=/);
  await expect(page.getByLabel("Sector")).toBeEnabled();
  await expect(page.getByLabel("Shariah-compliant (KMI)")).toBeEnabled();
});

test("choosing a symbol drops any sector/shariah already set", async ({ page }) => {
  await page.goto("/announcements?sector=COMMERCIAL%20BANKS&shariah=1");
  await expect(page.locator("main")).toContainText(DISCLAIMER);

  await page.getByLabel("Filter by symbol").fill("OGDC");
  await page.getByRole("option", { name: /OGDC/ }).first().click();

  await expect(page).toHaveURL(/[?&]symbol=OGDC/);
  await expect(page).not.toHaveURL(/[?&]sector=/);
  await expect(page).not.toHaveURL(/[?&]shariah=/);
  await expect(page.locator("main")).not.toContainText(DISCLAIMER);
});

test("the sector filter keeps only symbols genuinely in that sector", async ({
  page,
}) => {
  await page.goto("/announcements");
  const quotes = await marketWatch(page);
  const batch = await recentBatchSymbols(page);

  /*
   * Pick the sector best represented in the CURRENT batch, so the test
   * asserts against a non-empty result whatever PSX filed today rather
   * than hoping a hardcoded sector appears.
   */
  const counts = new Map<string, number>();
  for (const symbol of batch) {
    const s = quotes.get(symbol)?.sector;
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const [sector, expected] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  expect(expected, `best-represented sector in the batch: ${sector}`).toBeGreaterThan(0);

  await page.goto(`/announcements?sector=${encodeURIComponent(sector)}`);
  await expect(page.locator("main")).toContainText(DISCLAIMER);
  await expect(page.locator(ROWS).first()).toBeVisible();

  const rows = await visibleRows(page);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(quotes.get(row.symbol)?.sector, `${row.symbol} sector`).toBe(sector);
  }
  // The match count is stated against the batch, never as a grand total.
  await expect(page.locator("main")).toContainText(/match(es)? in filings/);
});

test("the Shariah-compliant toggle keeps only KMI index members", async ({
  page,
}) => {
  await page.goto("/announcements");
  const quotes = await marketWatch(page);

  await page.getByLabel("Shariah-compliant (KMI)").check();
  await expect(page).toHaveURL(/[?&]shariah=1/);
  await expect(page.locator("main")).toContainText(DISCLAIMER);
  // The methodology note appears with it — membership, not a ruling.
  await expect(page.locator("main")).toContainText(
    "not individual religious advice",
  );

  await expect(page.locator(ROWS).first()).toBeVisible();
  const rows = await visibleRows(page);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const quote = quotes.get(row.symbol);
    expect(
      Boolean(quote?.isKmi30 || quote?.isKmiAllShare),
      `${row.symbol} KMI membership`,
    ).toBe(true);
  }
});

test("a client-side filter reads one 100-row batch and says so", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/announcements/latest")) requested.push(r.url());
  });

  await page.goto("/announcements?shariah=1");
  await expect(page.locator("main")).toContainText(DISCLAIMER);
  await page.waitForTimeout(1500);

  // One batch per view, at PSX's own maximum — never a chain of
  // requests backfilling a full page of matches.
  expect(requested.length).toBeGreaterThan(0);
  for (const url of requested) {
    expect(url, url).toContain("count=100");
  }
});

test("the page reuses the cached Market Watch feed, adding no second fetch", async ({
  page,
}) => {
  const watchCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/market/watch")) watchCalls.push(r.url());
  });

  await page.goto("/announcements?sector=COMMERCIAL%20BANKS");
  await expect(page.locator("main")).toContainText(DISCLAIMER);
  await page.waitForTimeout(3000);

  /*
   * apiGet coalesces concurrent same-URL GETs, so the sector/KMI data
   * rides one request no matter how many consumers mount. More than one
   * would mean the dedup layer had been bypassed.
   */
  expect(watchCalls.length, watchCalls.join("\n")).toBeLessThanOrEqual(1);
});
