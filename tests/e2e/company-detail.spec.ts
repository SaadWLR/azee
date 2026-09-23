import { expect, test } from "./fixtures";
import type { APIRequestContext, Page } from "@playwright/test";

/*
 * Fundamentals and Profile on /market-watch/:symbol, from PSX's Data
 * Portal (/api/company/detail).
 *
 * The symbols here are chosen for their SHAPES, each verified against
 * the live page while this was built: a bank whose revenue row PSX
 * labels differently (HBL), a company PSX publishes no revenue row for
 * (PRWM), a recent listing whose ratios reach further back than its
 * financials (GEMPACRA), a listing with no ratios section at all and a
 * single quarterly column (PIAHCLB), and an ETF that redirects to a
 * page carrying neither section. Figures are checked against the same
 * payload the page read, never pinned to literals — these are live
 * numbers.
 *
 * SYMBOLS MUST BE IN THE MARKET-WATCH FEED to be tested through the
 * UI: these sections live inside the page's "quote found" state, and
 * the feed carries 494 of PSX's listings. ANLNV — the known blank
 * profile — is not one of them, so its payload is asserted directly
 * and its rendering is driven through a route mock carrying that same
 * real payload. None of the 40 thinnest in-feed symbols had a blank
 * profile, so no live symbol was available for it.
 *
 * Desktop-scoped like the other functional specs, to manage the
 * suite's known rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Section behaviour is viewport-independent; run once on desktop",
  );
});

/** Capital Stake's notice, exactly as it must reach a reader. */
const ATTRIBUTION =
  "Data powered by Capital Stake. To provide comparable data, information might have been standardized. The data presented may therefore differ from issuer's annual report and 'as reported' data should be obtained directly from the source issuer.";

interface Detail {
  symbol: string;
  kind: "company" | "etf";
  profile: {
    description?: string;
    keyPeople: { name: string; role: string }[];
    address?: string;
    website?: string;
    registrar?: string;
    auditor?: string;
    fiscalYearEnd?: string;
    isEmpty: boolean;
  } | null;
  fundamentals: {
    peRatioTtm: string | null;
    peFootnotes: string[];
    marketCapThousands: string | null;
    shares: string | null;
    freeFloatShares: string | null;
    freeFloatPercent: string | null;
    unitsNote: string | null;
    annual: Table | null;
    quarterly: Table | null;
    ratios: Table | null;
  } | null;
  footnotes: { marker: string; meaning: string }[];
  attribution: string | null;
}
interface Table {
  periods: string[];
  rows: { label: string; values: (string | null)[] }[];
}

async function detail(request: APIRequestContext, symbol: string): Promise<Detail> {
  const response = await request.get(
    `/api/company/detail?symbol=${encodeURIComponent(symbol)}`,
  );
  expect(response.status(), `GET company detail for ${symbol}`).toBe(200);
  return (await response.json()) as Detail;
}

/** Console errors this page logs, collected per test. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/vercel\.live/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${e}`));
  return errors;
}

test("a bank's revenue row keeps PSX's own label, and a non-bank's keeps its own", async ({
  request,
}) => {
  const [bank, nonBank] = await Promise.all([
    detail(request, "HBL"),
    detail(request, "OGDC"),
  ]);

  const labels = (d: Detail) => d.fundamentals!.annual!.rows.map((r) => r.label);
  /*
   * The whole reason this is parsed by label. PSX names this row by
   * sector, so a position-based read would file a bank's mark-up
   * income under "Sales" and never notice.
   */
  expect(labels(bank)).toContain("Mark-up Earned");
  expect(labels(bank)).not.toContain("Sales");
  expect(labels(nonBank)).toContain("Sales");
  expect(labels(nonBank)).not.toContain("Mark-up Earned");

  // Both shapes still carry the rows every company reports.
  for (const d of [bank, nonBank]) {
    expect(labels(d)).toContain("Profit after Taxation");
    expect(labels(d)).toContain("EPS");
    expect(d.fundamentals!.annual!.rows.every((r) => r.values.length === d.fundamentals!.annual!.periods.length)).toBe(true);
  }
});

test("the P/E footnote marker survives, and is explained", async ({ request }) => {
  const d = await detail(request, "HBL");
  const f = d.fundamentals!;
  expect(f.peRatioTtm).toMatch(/^[\d,]+\.\d+$/);
  // "**" changes what the figure means: unconsolidated, not group.
  expect(f.peFootnotes).toContain("**");
  const legend = d.footnotes.find((x) => x.marker === "**");
  expect(legend?.meaning).toBe("Based on unconsolidated financials");
});

test("an unknown symbol is caught by title, not by status code", async ({ request }) => {
  /*
   * PSX answers an unknown symbol with HTTP 500 and a "Not Found"
   * title. Trusting the status would turn a typo into an outage, so
   * this must come back 404 — a settled answer about the symbol.
   */
  const response = await request.get("/api/company/detail?symbol=ZZQQZZ");
  expect(response.status()).toBe(404);
  expect((await response.json()).error).toContain("ZZQQZZ");

  // And a malformed symbol never reaches PSX at all.
  const bad = await request.get("/api/company/detail?symbol=not%20a%20symbol");
  expect(bad.status()).toBe(400);
});

test("a lowercase symbol is upper-cased rather than 500ing on PSX", async ({
  request,
}) => {
  // PSX's path is case-sensitive: /company/hbl answers 500.
  const d = await detail(request, "hbl");
  expect(d.symbol).toBe("HBL");
  expect(d.fundamentals!.annual!.rows.length).toBeGreaterThan(0);
});

test("an ETF answers cleanly with neither section, and is not an error", async ({
  request,
  page,
}) => {
  const etf = await request.get("/api/company/detail?symbol=NBPGETF");
  expect(etf.status()).toBe(200);
  const body = (await etf.json()) as Detail;
  expect(body.kind).toBe("etf");
  expect(body.profile).toBeNull();
  expect(body.fundamentals).toBeNull();

  const errors = watchConsole(page);
  await page.goto("/market-watch/NBPGETF");
  /*
   * Wait for the page's own quote to land first. Asserting the two
   * sections are absent while the page is still empty would pass for
   * the wrong reason, on any symbol.
   */
  await expect(page.getByText(/^day range$/i).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  // Neither section, and nothing claiming something went wrong.
  await expect(page.getByRole("heading", { name: "Fundamentals" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Company profile" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("temporarily unavailable");
  expect(errors).toEqual([]);
});

test("a blank profile says so, instead of rendering an empty card", async ({
  request,
  page,
}) => {
  // A non-voting share class: PSX carries the headings, fills none in.
  const d = await detail(request, "ANLNV");
  expect(d.profile?.isEmpty).toBe(true);
  expect(d.fundamentals!.ratios).toBeNull();
  expect(d.fundamentals!.annual).toBeNull();
  // Its equity figures ARE published, so the section is not empty.
  expect(d.fundamentals!.shares).toBeTruthy();

  /*
   * ANLNV is absent from the market-watch feed, so /market-watch/ANLNV
   * never reaches the state these sections render in. The rendering is
   * therefore driven with ANLNV's OWN payload, served for a symbol the
   * feed does carry — real data, redirected, rather than a handwritten
   * fixture of what a blank profile might look like.
   */
  await page.route("**/api/company/detail**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) }),
  );
  await page.goto("/market-watch/PIAHCLB");

  const profile = page
    .getByRole("heading", { name: "Company profile", exact: true })
    .locator("..");
  await expect(profile).toBeVisible({ timeout: 20_000 });
  await expect(profile).toContainText("publishes no profile details");

  const fundamentals = page
    .getByRole("heading", { name: "Fundamentals", exact: true })
    .locator("..");
  // Said in words, not left as a gap that reads like a failed load.
  await expect(fundamentals).toContainText(
    "PSX publishes no financial statements or ratios for ANLNV",
  );
  // The equity figures PSX does publish are still shown.
  await expect(fundamentals).toContainText(d.fundamentals!.shares!);
});

test("a recent listing shows the history it has, padded to nothing", async ({
  request,
}) => {
  const d = await detail(request, "GEMPACRA");
  const f = d.fundamentals!;
  /*
   * Two annual columns is the real answer for a company listed
   * recently, and its ratios reach a year further back than its
   * financials do. Neither is padded to match the other, and the
   * ratio periods it has no figure for stay null rather than zero.
   */
  expect(f.annual!.periods.length).toBeGreaterThanOrEqual(1);
  expect(f.annual!.periods.length).toBeLessThan(4);
  expect(f.ratios!.periods.length).toBeGreaterThan(f.annual!.periods.length);
  for (const row of f.annual!.rows) {
    expect(row.values.length).toBe(f.annual!.periods.length);
  }
  for (const row of f.ratios!.rows) {
    expect(row.values.length).toBe(f.ratios!.periods.length);
  }
});

test("a company with no ratios at all renders its financials and stops", async ({
  request,
  page,
}) => {
  const d = await detail(request, "PIAHCLB");
  const f = d.fundamentals!;
  // PSX serves this one a single quarterly column and no ratios.
  expect(f.ratios).toBeNull();
  expect(f.annual).toBeNull();
  expect(f.quarterly!.periods.length).toBe(1);

  await page.goto("/market-watch/PIAHCLB");
  const fundamentals = page
    .getByRole("heading", { name: "Fundamentals", exact: true })
    .locator("..");
  await expect(fundamentals).toBeVisible({ timeout: 20_000 });
  await expect(fundamentals).toContainText("Financials — quarterly");
  await expect(fundamentals).toContainText(f.quarterly!.periods[0]);
  // No empty Ratios heading left behind where PSX publishes none.
  await expect(fundamentals).not.toContainText("Ratios");
  await expect(fundamentals).not.toContainText("Financials — annual");
});

test("quarterly columns are fiscal-year-relative, and there is no Q4", async ({
  request,
}) => {
  const d = await detail(request, "OGDC");
  const periods = d.fundamentals!.quarterly!.periods;
  expect(periods.length).toBeGreaterThan(0);
  for (const p of periods) expect(p).toMatch(/^Q[1-3] \d{4}$/);
  // PSX replaces Q4 with the annual figure and publishes no Q4 column.
  expect(periods.some((p) => p.startsWith("Q4"))).toBe(false);
});

test("a row PSX left empty is dropped, never shown as a zero", async ({ request }) => {
  const d = await detail(request, "CJPL");
  const f = d.fundamentals!;
  for (const table of [f.annual, f.quarterly, f.ratios]) {
    if (!table) continue;
    for (const row of table.rows) {
      // Every surviving row has at least one real figure in it.
      expect(row.values.some((v) => v !== null), `${row.label} is all blanks`).toBe(true);
      for (const value of row.values) {
        expect(value === null || value.trim().length > 0).toBe(true);
      }
    }
  }
});

test("both sections render real PSX data, with the attribution scoped to the tables", async ({
  request,
  page,
}) => {
  const d = await detail(request, "HBL");
  const f = d.fundamentals!;
  const errors = watchConsole(page);

  await page.goto("/market-watch/HBL");
  const fundamentals = page
    .getByRole("heading", { name: "Fundamentals", exact: true })
    .locator("..");
  await expect(fundamentals).toBeVisible({ timeout: 20_000 });

  // The figures on screen are the ones the API just served.
  await expect(fundamentals).toContainText(f.peRatioTtm!);
  await expect(fundamentals).toContainText(f.shares!);
  await expect(fundamentals).toContainText("Mark-up Earned");
  await expect(fundamentals).toContainText("Profit after Taxation");
  await expect(fundamentals).toContainText("Net Profit Margin (%)");
  await expect(fundamentals).toContainText(f.annual!.periods[0]);

  // Capital Stake's notice, verbatim, and inside the tables' section.
  expect(d.attribution).toBe(ATTRIBUTION);
  await expect(fundamentals).toContainText(ATTRIBUTION);

  const profile = page
    .getByRole("heading", { name: "Company profile", exact: true })
    .locator("..");
  await expect(profile).toContainText(d.profile!.keyPeople[0].name);
  await expect(profile).toContainText(d.profile!.auditor!);
  await expect(profile).toContainText(d.profile!.fiscalYearEnd!);
  // It covers the financials, not PSX's own profile and equity data.
  await expect(profile).not.toContainText("Capital Stake");

  expect(errors).toEqual([]);
});

test("nothing here duplicates the ranges and links the page already had", async ({
  page,
}) => {
  await page.goto("/market-watch/HBL");
  const main = page.locator("main");
  await expect(
    page.getByRole("heading", { name: "Fundamentals", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  /*
   * The day range, the trailing-year range and the announcements link
   * come from three other sources this page already trusted. PSX's
   * company page carries all three as well, and none of them is taken
   * from it — one of each, still.
   */
  await expect(main.getByText(/^day range$/i)).toHaveCount(1);
  await expect(main.getByText(/^(52-week range|range since )/i)).toHaveCount(1);
  await expect(main.getByRole("link", { name: /Company announcements for/ })).toHaveCount(1);
  // And no payouts or financial-reports table crept in with them.
  await expect(main.getByRole("heading", { name: /^Payouts$/ })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /Financial Reports/i })).toHaveCount(0);
});
