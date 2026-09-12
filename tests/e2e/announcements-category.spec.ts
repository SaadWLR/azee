import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  categorize,
  CATEGORY_TABS,
  isCategory,
  type Category,
} from "../../src/lib/announcementCategory";
import {
  applyCategory,
  applyMarketFilters,
  countByCategory,
} from "../../src/lib/announcementFilters";
import type { CompanyAnnouncement } from "../../src/types/announcements";
import type { StockQuote } from "../../src/types";

/*
 * The auto-tagged "Filing type" filter on /announcements.
 *
 * Its own file, so every earlier announcements spec stays untouched.
 *
 * Two halves. The unit tests pin categorize() and the filter stages
 * directly — every title in them is a real, verbatim PSX title read
 * from the live feed on Sep 11-12 2026, never an invented one. The page
 * tests then check the same behaviour against today's live batch.
 */

/* ── Unit: categorize() on real titles ─────────────────────────────── */

test.describe("categorize() — real PSX titles", () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== "desktop",
      "Pure-function tests; run once",
    );
  });

  /** [title, symbol, date filed, expected] — all verbatim from live data. */
  const ONE_PER_BUCKET: Array<[string, string, string, Category]> = [
    ["Notice of 79th Annual General Meeting", "PSX", "Sep 11, 2026", "meetings"],
    ["Notice of Corporate Briefing Session", "SYS", "Aug 28, 2026", "briefings"],
    [
      "Disclosure of Interest by Relevant Persons Holding Company Shares Under PSX Regulation 5.6.4",
      "TCORP",
      "Sep 11, 2026",
      "insiders",
    ],
    ["Credit of Interim Cash Dividend", "GLAXO", "Sep 11, 2026", "actions"],
    [
      "DISCLOSURE OF MATERIAL INFORMATION - GHANI GLOBAL GLASS LIMITED",
      "GGGL",
      "Sep 10, 2026",
      "material",
    ],
    ["Financial Results for the Year Ended 30 June 2026", "BPL", "Sep 11, 2026", "financials"],
  ];

  for (const [title, symbol, date, expected] of ONE_PER_BUCKET) {
    test(`${expected}: ${symbol} (${date})`, () => {
      expect(categorize(title)).toBe(expected);
    });
  }

  test("titles with no rule keyword fall through to Other", () => {
    const REAL_OTHERS: Array<[string, string]> = [
      ["Resignation of Chief Financial Officer", "PICT"],
      ["PUBLICATION OF POSTAL BALLOT PAPER AND PROVISION OF E-VOTING (BEFORE PUBLICATION)", "ACPL"],
      ["Change of Company Secretary", "KOHC"],
      ["Appointment of Head of Internal Audit", "GEMMEL"],
    ];
    for (const [title, symbol] of REAL_OTHERS) {
      expect(categorize(title), `${symbol}: ${title}`).toBe("other");
    }
  });

  test("priority decides overlapping titles, first match wins", () => {
    // Names both a meeting and financial results — Meetings is checked first.
    expect(categorize("Board Meeting other than Financial Results")).toBe("meetings");
    // Material information about a merger — Actions outranks Material.
    expect(
      categorize(
        "Material Information regarding Approval of Competition Commission of Pakistan for Proposed Merger of SPAC I with and into NGLE",
      ),
    ).toBe("actions");
  });

  test("matching is case-insensitive", () => {
    expect(categorize("BOARD MEETING")).toBe("meetings");
    expect(categorize("CREDIT OF INTERIM CASH DIVIDEND")).toBe("actions");
  });

  test("every tab id is a valid category and nothing else is", () => {
    for (const tab of CATEGORY_TABS) expect(isCategory(tab.id)).toBe(true);
    expect(isCategory("")).toBe(false);
    expect(isCategory("dividends")).toBe(false);
  });
});

/* ── Unit: the two filter stages stay independent ──────────────────── */

test.describe("filter stages — constructed, independent of today's data", () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== "desktop",
      "Pure-function tests; run once",
    );
  });

  const row = (id: string, symbol: string, title: string): CompanyAnnouncement => ({
    id,
    announcedAt: "2026-09-11T10:00:00.000Z",
    dateText: "Sep 11, 2026",
    timeText: "3:00 PM",
    symbol,
    companyName: symbol,
    title,
    documentUrl: null,
    documentType: null,
  });

  /*
   * MCBIM-FUNDS is a real fund-manager pseudo-symbol that files daily
   * and is NOT in the Market Watch feed (verified live) — exactly the
   * delisted / non-traded case category must not drop.
   */
  const fund = row(
    "1",
    "MCBIM-FUNDS",
    "ALHAMRA DAILY DIVIDEND FUND (ALHDDF) Daily Dividend Distribution for 10-SEP-26",
  );
  const bank = row("2", "BAHL", "BAHL - Credit of 2nd Interim Cash Dividend");
  const results = row("3", "BPL", "Financial Results for the Year Ended 30 June 2026");

  const lookup = new Map<string, StockQuote>([
    ["BAHL", { symbol: "BAHL", price: 1, changePercent: 0, sector: "COMMERCIAL BANKS", isKmiAllShare: false }],
    ["BPL", { symbol: "BPL", price: 1, changePercent: 0, sector: "TEXTILE COMPOSITE", isKmiAllShare: true }],
  ]);

  test("a filing from a symbol absent from Market Watch is still categorised", () => {
    const working = applyMarketFilters([fund, bank, results], { sector: "", shariah: false }, lookup);
    // No sector/Shariah → the lookup is never consulted, nothing dropped.
    expect(working.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(applyCategory(working, "actions").map((r) => r.symbol)).toEqual(["MCBIM-FUNDS", "BAHL"]);
    expect(countByCategory(working).actions).toBe(2);
  });

  test("sector still drops what it cannot place, and category runs over what remains", () => {
    const working = applyMarketFilters([fund, bank, results], { sector: "COMMERCIAL BANKS", shariah: false }, lookup);
    // MCBIM-FUNDS cannot be placed in a sector, so the SECTOR stage drops it...
    expect(working.map((r) => r.symbol)).toEqual(["BAHL"]);
    // ...and category narrows only that working set.
    expect(applyCategory(working, "actions").map((r) => r.symbol)).toEqual(["BAHL"]);
    expect(applyCategory(working, "financials")).toEqual([]);
  });

  test("tab counts describe the working set before category narrows it", () => {
    const working = applyMarketFilters([fund, bank, results], { sector: "", shariah: false }, lookup);
    const counts = countByCategory(working);
    expect(counts.actions).toBe(2);
    expect(counts.financials).toBe(1);
    const sum = CATEGORY_TABS.reduce((n, tab) => n + counts[tab.id], 0);
    expect(sum).toBe(working.length);
  });
});

/* ── Page: live behaviour ──────────────────────────────────────────── */

test.describe("Filing type on the live page", () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== "desktop",
      "Announcement filters are viewport-independent; run once on desktop",
    );
  });

  const ROWS = "main table tbody tr";
  const DISCLAIMER = /Showing matches from the most recent 100 PSX filings — not a complete history for these filters/;
  const AUTO_TAG = "auto-tagged by AZEE from each filing";

  /*
   * Read inside the page, so the fixture's rate-limit bypass (installed
   * with context.route, which only sees page-initiated requests) applies.
   */
  async function marketWatchSymbols(page: Page) {
    return page.evaluate(async () => {
      const res = await fetch("/api/market/watch", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`market watch ${res.status}`);
      return (await res.json()).quotes as Array<{ symbol: string; sector?: string }>;
    });
  }

  async function visibleTitles(page: Page) {
    return page.locator(ROWS).evaluateAll((trs) =>
      trs.map((tr) => {
        const td = [...tr.querySelectorAll("td")].map((c) => c.textContent!.trim());
        return { symbol: td[2], title: td[4].replace(/\s*scan$/i, "").trim() };
      }),
    );
  }

  test("the auto-tag line is always shown; the batch disclaimer only when filtering", async ({
    page,
  }) => {
    await page.goto("/announcements");
    await expect(page.locator("main table tbody tr").first()).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Filing type" })).toBeVisible();
    await expect(page.locator("main")).toContainText(AUTO_TAG);
    // Default view: PSX's own page, no client-side filter, no disclaimer.
    await expect(page.locator("main")).not.toContainText(DISCLAIMER);

    await page.getByRole("tab", { name: /^Financials/ }).click();
    await expect(page).toHaveURL(/[?&]category=financials/);
    await expect(page.locator("main")).toContainText(DISCLAIMER);
    // Both claims at once, as two separate lines.
    await expect(page.locator("main")).toContainText(AUTO_TAG);
  });

  test("a category tab keeps only filings of that type, from a 100-row batch", async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/announcements/latest")) requested.push(r.url());
    });

    await page.goto("/announcements?category=insiders");
    await expect(page.locator(ROWS).first()).toBeVisible();

    const rows = await visibleTitles(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(categorize(r.title), `${r.symbol}: ${r.title}`).toBe("insiders");
    }
    for (const url of requested) expect(url).toContain("count=100");
  });

  test("tab counts split the whole working set, whichever tab is selected", async ({
    page,
  }) => {
    await page.goto("/announcements?category=financials");
    await expect(page.locator(ROWS).first()).toBeVisible();

    const readCounts = () =>
      page.getByRole("tab").evaluateAll((tabs) =>
        tabs.map((t) => {
          const m = /^(.*?)\s*(\d+)$/.exec(t.textContent!.trim());
          return { label: m ? m[1].trim() : t.textContent!.trim(), n: m ? Number(m[2]) : NaN };
        }),
      );

    const onFinancials = await readCounts();
    const all = onFinancials.find((t) => t.label === "All")!.n;
    const sum = onFinancials.filter((t) => t.label !== "All").reduce((s, t) => s + t.n, 0);
    expect(sum, "the seven types add up to All").toBe(all);

    await page.getByRole("tab", { name: /^Meetings/ }).click();
    await expect(page).toHaveURL(/[?&]category=meetings/);
    await expect(page.getByRole("tab", { name: /^Meetings/ })).toHaveAttribute("aria-selected", "true");
    const onMeetings = await readCounts();
    // Same batch, same working set — switching tabs does not move the counts.
    expect(onMeetings).toEqual(onFinancials);
  });

  test("selecting a category resets to page 1", async ({ page }) => {
    await page.goto("/announcements?page=3");
    await expect(page.locator("main")).toContainText("Page 3");
    await page.getByRole("tab", { name: /^Actions/ }).click();
    await expect(page).toHaveURL(/[?&]category=actions/);
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test("category composes with a sector — rows satisfy both", async ({ page }) => {
    await page.goto("/announcements");
    const quotes = await marketWatchSymbols(page);
    const sectorOf = new Map(quotes.map((q) => [q.symbol, q.sector]));

    const batch = await page.evaluate(async () => {
      const res = await fetch("/api/announcements/latest?count=100&offset=0", {
        headers: { Accept: "application/json" },
      });
      return (await res.json()).announcements as Array<{ symbol: string; title: string }>;
    });

    // Find a sector + category pair that is genuinely present right now.
    const pairs = new Map<string, number>();
    for (const a of batch) {
      const s = sectorOf.get(a.symbol);
      if (!s) continue;
      const key = `${s}|${categorize(a.title)}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    const [pair] = [...pairs.entries()].sort((a, b) => b[1] - a[1])[0];
    const [sector, category] = pair.split("|");

    await page.goto(`/announcements?sector=${encodeURIComponent(sector)}&category=${category}`);
    await expect(page.locator(ROWS).first()).toBeVisible();
    const rows = await visibleTitles(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(sectorOf.get(r.symbol), `${r.symbol} sector`).toBe(sector);
      expect(categorize(r.title), `${r.symbol}: ${r.title}`).toBe(category);
    }
  });

  test("a symbol never disables the filing-type tabs", async ({ page }) => {
    await page.goto("/announcements?symbol=OGDC&category=material");
    await expect(page.getByLabel("Sector")).toBeDisabled();
    for (const tab of await page.getByRole("tab").all()) {
      await expect(tab).toBeEnabled();
    }
    await expect(page.getByRole("tab", { name: /^Material/ })).toHaveAttribute("aria-selected", "true");
  });

  test("a symbol absent from Market Watch still categorises (MCBIM-FUNDS)", async ({
    page,
  }) => {
    await page.goto("/announcements");
    const quotes = await marketWatchSymbols(page);
    // Keep the test honest: it only proves anything while the premise holds.
    expect(quotes.some((q) => q.symbol === "MCBIM-FUNDS")).toBe(false);

    await page.goto("/announcements?symbol=MCBIM-FUNDS&category=actions");
    await expect(page.locator(ROWS).first()).toBeVisible();
    const rows = await visibleTitles(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.symbol).toBe("MCBIM-FUNDS");
      expect(categorize(r.title)).toBe("actions");
    }
  });

  test("a category with no matches in the batch says so plainly", async ({ page }) => {
    /*
     * Find a genuinely empty tab from the live counts rather than hoping
     * one is empty. MCBIM-FUNDS files almost nothing but daily dividend
     * distributions and fund manager reports, so several of its types are
     * zero — and if none were, this fails loudly instead of passing on
     * nothing.
     */
    await page.goto("/announcements?symbol=MCBIM-FUNDS&category=actions");
    await expect(page.locator(ROWS).first()).toBeVisible();

    const counts = await page.getByRole("tab").evaluateAll((tabs) =>
      tabs.map((t) => {
        const m = /^(.*?)\s*(\d+)$/.exec(t.textContent!.trim());
        return { label: m ? m[1].trim() : "", n: m ? Number(m[2]) : NaN };
      }),
    );
    const empty = counts.find((t) => t.label !== "All" && t.n === 0);
    expect(empty, `an empty filing type among ${JSON.stringify(counts)}`).toBeTruthy();

    await page.getByRole("tab", { name: new RegExp(`^${empty!.label}`) }).click();
    await expect(page.locator(ROWS)).toHaveCount(0);
    await expect(page.locator("main")).toContainText(
      new RegExp(`No filings in this batch of \\d+ are tagged ${empty!.label}\\.`),
    );
    await expect(page.locator("main")).not.toContainText(/temporarily unavailable/i);
  });
});
