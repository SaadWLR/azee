import { expect, test } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

/*
 * The company detail page (/market-watch/:symbol): the live quote's
 * session range, the trailing-year closing range computed from the EOD
 * archive, sector peers, and the announcements link.
 *
 * Every figure is cross-checked against the SAME API payload the page
 * reads, in the same run, rather than pinned to a literal — these are
 * live PSX numbers and change by the minute. What is asserted is that
 * the page reports what the feed says, and stays honest where the feed
 * says nothing.
 *
 * Desktop-scoped like the other functional specs, to manage the suite's
 * known rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Detail-page behaviour is viewport-independent; run once on desktop",
  );
});

interface Quote {
  symbol: string;
  name?: string;
  sector?: string;
  price: number;
  changePercent: number;
  changePoints?: number;
  volume?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
}

async function quotes(request: APIRequestContext): Promise<Quote[]> {
  const response = await request.get("/api/market/watch");
  expect(response.status()).toBe(200);
  return (await response.json()).quotes as Quote[];
}

/** Two decimals with thousands separators — what fmtNum renders. */
const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("the API carries the session range, and drops it rather than publishing a zero", async ({
  request,
}) => {
  const rows = await quotes(request);
  const ranged = rows.filter((q) => q.dayHigh !== undefined);
  // PSX publishes a range for nearly every symbol; a wholesale absence
  // would mean the columns moved, not that the market went quiet.
  expect(ranged.length).toBeGreaterThan(rows.length * 0.8);

  for (const q of rows) {
    // A zero is "not published" and must never reach the payload.
    for (const field of ["open", "dayHigh", "dayLow", "previousClose"] as const) {
      if (q[field] !== undefined) expect(q[field], `${q.symbol}.${field}`).toBeGreaterThan(0);
    }
    // Both ends of the range, or neither — never half of one.
    expect(q.dayLow === undefined, `${q.symbol} half range`).toBe(q.dayHigh === undefined);
    if (q.dayLow !== undefined && q.dayHigh !== undefined) {
      expect(q.dayLow, `${q.symbol} low ≤ high`).toBeLessThanOrEqual(q.dayHigh + 0.011);
    }
    // previousClose is the same figure the row's own change implies.
    if (q.previousClose !== undefined && q.changePoints !== undefined) {
      expect(Math.abs(q.previousClose - (q.price - q.changePoints)), q.symbol).toBeLessThan(0.011);
    }
  }
});

test("day range, open and previous close match the feed for a traded symbol", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  // The most-traded symbol that publishes a full range: busiest rows are
  // the least likely to be mid-halt or otherwise exceptional.
  const target = rows
    .filter((q) => q.dayHigh !== undefined && q.dayLow !== undefined && q.open !== undefined)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];
  expect(target, "some symbol publishes a full session range").toBeTruthy();

  await page.goto(`/market-watch/${target.symbol}`);
  const card = page.locator("main").getByText("Current", { exact: true }).locator("..").locator("..");
  await expect(card).toContainText(money(target.price));

  const label = (name: string) => card.getByText(name, { exact: true }).locator("..");
  await expect(label("Day range")).toContainText(money(target.dayLow!));
  await expect(label("Day range")).toContainText(money(target.dayHigh!));
  await expect(label("Open")).toContainText(money(target.open!));
  await expect(label("Previous close")).toContainText(money(target.previousClose!));
});

test("a symbol PSX publishes no range for shows no range, not zeros", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const bare = rows.find((q) => q.dayHigh === undefined && q.previousClose !== undefined);
  test.skip(!bare, "every symbol published a session range in this run");

  await page.goto(`/market-watch/${bare!.symbol}`);
  const main = page.locator("main");
  await expect(main.getByText("Current", { exact: true })).toBeVisible();
  // Absent, not "0.00 – 0.00".
  await expect(main.getByText("Day range", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Open", { exact: true })).toHaveCount(0);
  await expect(main).not.toContainText("0.00 – 0.00");
  // What it does have is still shown.
  await expect(main.getByText("Previous close", { exact: true })).toBeVisible();
});

test("the trailing-year range is the archive's own closing high and low", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const target = rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];

  const history = await request.get(
    `/api/market/history?symbol=${encodeURIComponent(target.symbol)}`,
  );
  expect(history.status()).toBe(200);
  const points = (await history.json()).points as { date: string; close: number }[];
  test.skip(points.length < 2, `no archive for ${target.symbol}`);

  // The same window the page computes: calendar days back from the
  // newest session, matching the chart's 1Y tab.
  const latest = points[points.length - 1].date;
  const cutoff = new Date(`${latest}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);
  const windowed = points.filter((p) => p.date >= cutoff.toISOString().slice(0, 10));
  const closes = windowed.map((p) => p.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);

  await page.goto(`/market-watch/${target.symbol}`);
  const card = page
    .locator("main")
    .getByText(/^(52-week range|Range since )/)
    .locator("..");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(money(low));
  await expect(card).toContainText(money(high));
  // Honest about what the figure is: closes, not intraday extremes.
  await expect(card).toContainText(/CLOSING price/i);
  await expect(card).toContainText(`${windowed.length} sessions`);
  // The current price cannot sit outside its own trailing-year range by
  // more than the range's own newest session allows — a sanity check
  // that the window is this symbol's archive and not another's.
  expect(target.price).toBeGreaterThan(low * 0.5);
  expect(target.price).toBeLessThan(high * 2);
});

/** The card's own numbers, recomputed here from the archive it reads. */
async function archive(request: APIRequestContext, symbol: string) {
  const response = await request.get(
    `/api/market/history?symbol=${encodeURIComponent(symbol)}`,
  );
  expect(response.status()).toBe(200);
  return (await response.json()).points as { date: string; close: number }[];
}

test("SMA-50, SMA-200 and RSI-14 match the archive they are computed from", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const target = rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];
  const points = await archive(request, target.symbol);
  test.skip(points.length < 200, `${target.symbol} has too short an archive for SMA-200`);

  const closes = points.map((p) => p.close);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sma50 = mean(closes.slice(-50));
  const sma200 = mean(closes.slice(-200));
  // Wilder's smoothing, written out here rather than imported, so the
  // page is checked against arithmetic this file owns.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= 14; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= 14;
  avgLoss /= 14;
  for (let i = 15; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * 13 + Math.max(delta, 0)) / 14;
    avgLoss = (avgLoss * 13 + Math.max(-delta, 0)) / 14;
  }
  const rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  await page.goto(`/market-watch/${target.symbol}`);
  const section = page
    .getByRole("heading", { name: "Technical indicators", exact: true })
    .locator("..");
  await expect(section).toBeVisible({ timeout: 20_000 });

  const money = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const field = (label: string) => section.getByText(label, { exact: true }).locator("..");
  await expect(field("SMA-50")).toContainText(money(sma50));
  await expect(field("SMA-200")).toContainText(money(sma200));
  await expect(field("RSI-14")).toContainText(money(rsi14));

  // The reading is described, never acted on.
  const zone = rsi14 > 70 ? "overbought" : rsi14 < 30 ? "oversold" : "Between 30 and 70";
  await expect(field("RSI-14")).toContainText(zone);
});

test("a short archive computes what it can and says why the rest is missing", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  // A symbol whose archive is long enough for RSI-14 but not SMA-200.
  let short: { symbol: string; points: number } | undefined;
  for (const q of rows.slice(0, 40)) {
    const points = await archive(request, q.symbol);
    if (points.length >= 51 && points.length < 200) {
      short = { symbol: q.symbol, points: points.length };
      break;
    }
  }
  test.skip(!short, "no symbol in this sample has a 51–199 session archive");

  await page.goto(`/market-watch/${short!.symbol}`);
  const section = page
    .getByRole("heading", { name: "Technical indicators", exact: true })
    .locator("..");
  await expect(section).toBeVisible({ timeout: 20_000 });

  // SMA-200 is absent with its reason stated in full, and the two that
  // can be computed still are.
  await expect(section).toContainText(
    `Needs 200 sessions; this archive has ${short!.points.toLocaleString("en-US")}.`,
  );
  await expect(section.getByText("SMA-50", { exact: true }).locator("..")).toContainText("PKR");
  await expect(section.getByText("RSI-14", { exact: true }).locator("..")).toContainText(/\d/);
});

test("the indicators section states who computed it, and recommends nothing", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const target = rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];

  await page.goto(`/market-watch/${target.symbol}`);
  const section = page
    .getByRole("heading", { name: "Technical indicators", exact: true })
    .locator("..");
  await expect(section).toBeVisible({ timeout: 20_000 });

  /*
   * Whose numbers these are. Only what AZEE computed: no claim about
   * what PSX or anyone else publishes, which is how the 52-week card
   * went wrong.
   */
  await expect(section).toContainText(
    "Computed by AZEE from the Pakistan Stock Exchange's published closing prices. SMA-50 and SMA-200",
  );
  await expect(section).not.toContainText("does not publish");
  await expect(section).toContainText("Wilder's smoothing");
  await expect(section).toContainText("Information only, not investment advice");

  /*
   * The line this feature must not cross. "Overbought" and "oversold"
   * are RSI's own zone names and are allowed; a verdict is not.
   */
  const copy = (await section.innerText()).toLowerCase();
  for (const word of [
    "buy",
    "sell",
    "hold",
    "bullish",
    "bearish",
    "signal",
    "recommend",
    "target price",
    "outperform",
    "undervalued",
    "overvalued",
    "strong",
    "momentum",
  ]) {
    expect(copy, `"${word}" must not appear in the indicators section`).not.toContain(word);
  }
});

test("sector peers are the same sector, capped, biggest move first, and each links on", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  // A symbol from the largest sector, so the cap is exercised.
  const counts = new Map<string, number>();
  for (const q of rows) if (q.sector) counts.set(q.sector, (counts.get(q.sector) ?? 0) + 1);
  const [biggestSector] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const target = rows.find((q) => q.sector === biggestSector)!;
  const expectedPeers = rows
    .filter((q) => q.sector === biggestSector && q.symbol !== target.symbol)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  await page.goto(`/market-watch/${target.symbol}`);
  // By its heading: the whole page is a <section> too, and a text filter
  // matches that outer one as well.
  const section = page
    .getByRole("heading", { name: `Others in ${biggestSector}`, exact: true })
    .locator("..");
  await expect(section).toBeVisible();

  const links = section.locator("ul a");
  await expect(links).toHaveCount(8); // PEER_CAP
  await expect(section).toContainText(`${expectedPeers.length} other symbols`);

  const shown = await links.evaluateAll((as) =>
    as.map((a) => ({
      symbol: a.querySelector("span")!.textContent!.trim(),
      href: a.getAttribute("href"),
    })),
  );
  // Same sector, never the symbol being viewed, and each row is a link
  // to that peer's own page.
  for (const row of shown) {
    const peer = rows.find((q) => q.symbol === row.symbol);
    expect(peer, `${row.symbol} is a real quote`).toBeTruthy();
    expect(peer!.sector).toBe(biggestSector);
    expect(row.symbol).not.toBe(target.symbol);
    expect(row.href).toBe(`/market-watch/${row.symbol}`);
  }
  // Ordered by the size of today's move, largest first.
  const moves = shown.map((r) => Math.abs(rows.find((q) => q.symbol === r.symbol)!.changePercent));
  expect(moves).toEqual([...moves].sort((a, b) => b - a));
  // And they are the top of the sector by that measure.
  expect(shown.map((r) => r.symbol)).toEqual(
    expectedPeers.slice(0, 8).map((q) => q.symbol),
  );

  // Following a peer lands on its own detail page.
  await links.first().click();
  await expect(page).toHaveURL(`/market-watch/${shown[0].symbol}`);
});

test("a symbol with no sector peers has no peers section at all", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const counts = new Map<string, number>();
  for (const q of rows) if (q.sector) counts.set(q.sector, (counts.get(q.sector) ?? 0) + 1);
  // Either no sector at all, or the only symbol in its own.
  const alone = rows.find((q) => !q.sector || counts.get(q.sector) === 1);
  test.skip(!alone, "every symbol had at least one sector peer in this run");

  await page.goto(`/market-watch/${alone!.symbol}`);
  await expect(page.locator("main").getByText("Current", { exact: true })).toBeVisible();
  // An empty card would be worse than none.
  await expect(page.getByText(/^Others in /)).toHaveCount(0);
});

test("the announcements link opens that symbol's filings, already filtered", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  const target = rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];

  await page.goto(`/market-watch/${target.symbol}`);
  const link = page.getByRole("link", { name: new RegExp(`announcements for ${target.symbol}`, "i") });
  await expect(link).toHaveAttribute("href", `/announcements?symbol=${target.symbol}`);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/announcements\\?symbol=${target.symbol}$`));
  await expect(page.locator("h1")).toBeVisible();
  // The filter arrives applied, not merely offered.
  await expect(page.locator("main")).toContainText(target.symbol);
});

test("Market Watch's own table is unaffected by the added quote fields", async ({
  page,
  request,
}) => {
  const rows = await quotes(request);
  await page.goto("/market-watch");
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  // The table's columns are the ones it always had — the new fields are
  // for the detail page and must not have leaked into this view.
  const headers = (await page.locator("table thead th").allTextContents()).map((h) =>
    h.replace(/[▲▼↑↓\s]+/g, " ").trim(),
  );
  expect(headers).toHaveLength(6);
  for (const label of ["Symbol", "Sector", "Price", "Change %", "Change", "Volume"]) {
    expect(headers.some((h) => h === label || h.startsWith(label)), `${label} column`).toBe(true);
  }
  for (const added of ["Day range", "Open", "Previous close", "52-week"]) {
    expect(headers.join("|"), `${added} must not appear`).not.toContain(added);
  }

  // And the first row still reports the same price the feed carries.
  // The ticker comes from its own anchor: the first cell renders the
  // company name alongside it, so its text is not the symbol.
  const firstRow = page.locator("table tbody tr").first();
  const symbol = (
    await firstRow.locator('a[href^="/market-watch/"]').first().getAttribute("href")
  )!.replace("/market-watch/", "");
  const first = await firstRow.locator("td").allTextContents();
  const quote = rows.find((q) => q.symbol === symbol);
  expect(quote, `${symbol} is in the feed`).toBeTruthy();
  expect(first.join(" ")).toContain(money(quote!.price));
});
