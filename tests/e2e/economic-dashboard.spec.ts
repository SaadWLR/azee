import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * /economic-dashboard, rendered from /api/economic/dashboard.
 *
 * Desktop-scoped like the other functional specs: the states under test
 * are viewport-independent, and the suite's API volume is kept low.
 *
 * The first test reads PRODUCTION's real snapshot and checks the page
 * against the very payload it rendered — so it asserts exact agreement
 * without hardcoding figures that SBP will revise. The others fulfil
 * the API request themselves, because production is past "pending" and
 * almost always fully fresh: the page's degraded states would otherwise
 * never be exercised. Those bodies use real figures captured from the
 * live endpoint (Sep 13 2026); only statuses and timestamps are varied.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Economic dashboard states are viewport-independent; run once on desktop",
  );
});

const API = "**/api/economic/dashboard*";

const TITLES = {
  policyRate: "SBP policy rate",
  cpi: "Inflation (CPI)",
  gdpAnnual: "Real GDP growth — annual",
  gdpQuarterly: "Real GDP growth — quarterly",
  fxReserves: "Foreign exchange reserves",
  externalDebt: "External debt and liabilities",
  debtServicing: "External debt servicing",
  trade: "Trade in goods",
  remittances: "Workers' remittances",
} as const;

type Key = keyof typeof TITLES;

function card(page: Page, key: Key) {
  return page
    .locator("main article")
    .filter({ has: page.getByRole("heading", { name: TITLES[key], exact: true }) });
}

/** The page's own number formatting: SBP precision, at most two decimals. */
function fmt(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Console errors and uncaught page errors, collected for the whole test. */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  return errors;
}

/* ── Mock bodies (real figures, varied statuses) ─────────────────── */

const SRC = "https://easydata.sbp.org.pk/apex/f?p=10:211:0";
const FETCHED = "2026-09-13T18:59:26.000Z";
function fresh(periodLabel: string, asOf: string, frequency: string, values: unknown, seriesKeys: string[]) {
  return { status: "fresh", periodLabel, asOf, frequency, values, source: { url: SRC, seriesKeys }, fetchedAt: FETCHED };
}

const READY = {
  status: "ready",
  source: "sbp-easydata",
  updatedAt: "2026-09-13T18:59:23.689Z",
  indicators: {
    policyRate: fresh("28-Apr-2026", "2026-04-28", "as-needed", { ratePercent: 11.5, lastChangeDate: "2026-04-28" }, ["TS_GP_IR_SIRPR_AH.SBPOL0030"]),
    cpi: fresh("Aug-2026", "2026-08-31", "monthly", {
      headline: { yoyPercent: 11.1, momPercent: 1.2 },
      core: { measure: "NFNE", urban: { yoyPercent: 8.8, momPercent: 0.5 }, rural: { yoyPercent: 8.5, momPercent: 0.6 } },
    }, ["TS_GP_PT_CPI_M.P00011516"]),
    gdpAnnual: fresh("2026", "2026-06-30", "fiscal-year", { growthPercent: 3.7 }, ["TS_GP_RLS_PAKGDP15_Y.GDP00160000"]),
    gdpQuarterly: fresh("Mar-2026", "2026-03-31", "quarterly", { growthPercent: 3.99 }, ["TS_GP_RS_QGDP1516_Q.QGDP00080000"]),
    fxReserves: fresh("Jul-2026", "2026-07-31", "monthly", {
      sbpNetMillionUsd: 17043.1,
      banksNetMillionUsd: 4845.63,
      total: {
        millionUsd: 21888.73,
        computed: true,
        formula: "Net reserves with SBP + net reserves with banks — SBP's own definition of total liquid FX reserves (row 19 = 2 + 10), whose published series (TS_GP_EXT_PAKRES_M.Z00060) is empty on EasyData",
      },
    }, ["TS_GP_EXT_PAKRES_M.Z00030", "TS_GP_EXT_PAKRES_M.Z00050"]),
    externalDebt: fresh("Jun-2026", "2026-06-30", "quarterly", { totalMillionUsd: 138849.81 }, ["TS_GP_ED_PKEDLOUT_Q.STO00570"]),
    debtServicing: fresh("Jun-2026", "2026-06-30", "quarterly", {
      longTermPrincipalMillionUsd: 8591.53,
      shortTermPrincipalMillionUsd: 215.81,
      interestMillionUsd: 1329.32,
    }, ["TS_GP_ED_PKEDLSER_Q.DS00300"]),
    trade: fresh("Jul-2026", "2026-07-31", "monthly", {
      exportsMillionUsd: 3008,
      importsMillionUsd: 6154,
      balanceMillionUsd: -3146,
      basis: "balance-of-payments-goods",
    }, ["TS_GP_BOP_BPM6SUM_M.P00030"]),
    remittances: fresh("Aug-2026", "2026-08-31", "monthly", { inflowMillionUsd: 3656.33767 }, ["TS_GP_BOP_WR_M.WR0340"]),
  },
};

const DEGRADED = {
  ...READY,
  indicators: {
    ...READY.indicators,
    cpi: {
      ...READY.indicators.cpi,
      status: "stale",
      fetchedAt: "2026-09-11T14:04:12.310Z",
      staleSince: "2026-09-12T14:03:58.102Z",
      lastAttemptAt: "2026-09-13T18:59:23.689Z",
      lastError: "SBP responded 503",
    },
    gdpQuarterly: {
      status: "unavailable",
      lastAttemptAt: "2026-09-13T18:59:23.689Z",
      lastError: "EasyData rejected the page checksum (session state protection)",
    },
  },
};

async function serve(page: Page, status: number, body: unknown) {
  await page.route(API, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

/* ── Tests ────────────────────────────────────────────────────────── */

test("renders all nine live indicators exactly as the API serves them", async ({ page }) => {
  const errors = watchConsole(page);
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/economic/dashboard") && r.request().method() === "GET",
  );
  await page.goto("/economic-dashboard");
  const snapshot = await (await response).json();
  expect(snapshot.status).toBe("ready");

  const main = page.locator("main");
  await expect(main.locator("article")).toHaveCount(9);

  // When we collected, stated once and apart from the cards' periods.
  const updated = await page.evaluate(
    (iso) =>
      `${new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" })} PKT`,
    snapshot.updatedAt,
  );
  await expect(main).toContainText(`Last collected from SBP EasyData: ${updated}`);

  for (const key of Object.keys(TITLES) as Key[]) {
    const indicator = snapshot.indicators[key];
    const c = card(page, key);
    await expect(c, key).toHaveCount(1);
    if (indicator.status === "unavailable") {
      await expect(c).toContainText("Not yet available");
      continue;
    }
    // Each card names its own period, verbatim from SBP (the policy
    // rate's is its change date, checked below).
    if (key !== "policyRate") await expect(c).toContainText(indicator.periodLabel);
    await expect(c.getByRole("link", { name: "SBP EasyData" })).toHaveAttribute("href", indicator.source.url);
  }

  const ind = snapshot.indicators;
  const text = async (key: Key) => (await card(page, key).innerText()).replace(/\s+/g, " ");

  if (ind.policyRate.status !== "unavailable") {
    const v = ind.policyRate.values;
    const day = await page.evaluate(
      (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
      v.lastChangeDate,
    );
    const t = await text("policyRate");
    expect(t).toContain(`Policy (target) rate ${fmt(v.ratePercent)}%`);
    expect(t).toContain(`Date of last policy rate change ${day}`);
    // "Last change", never "last MPC decision" — EasyData publishes no such date.
    expect(t).not.toMatch(/MPC decision|last Monetary Policy Committee decision/i);
  }

  if (ind.cpi.status !== "unavailable") {
    const v = ind.cpi.values;
    const t = await text("cpi");
    expect(t).toContain(`Headline (national CPI) ${fmt(v.headline.yoyPercent)}% ${fmt(v.headline.momPercent)}%`);
    expect(t).toContain(`Core, urban (NFNE) ${fmt(v.core.urban.yoyPercent)}% ${fmt(v.core.urban.momPercent)}%`);
    expect(t).toContain(`Core, rural (NFNE) ${fmt(v.core.rural.yoyPercent)}% ${fmt(v.core.rural.momPercent)}%`);
  }

  // Two GDP readings, two period types, never merged.
  if (ind.gdpAnnual.status !== "unavailable") {
    const t = await text("gdpAnnual");
    expect(t).toContain(`fiscal year ${ind.gdpAnnual.periodLabel}`);
    expect(t).toContain(`Growth rate ${fmt(ind.gdpAnnual.values.growthPercent)}%`);
  }
  if (ind.gdpQuarterly.status !== "unavailable") {
    const t = await text("gdpQuarterly");
    expect(t).toContain(`quarter ending ${ind.gdpQuarterly.periodLabel}`);
    expect(t).toContain(`Growth rate ${fmt(ind.gdpQuarterly.values.growthPercent)}%`);
  }

  if (ind.fxReserves.status !== "unavailable") {
    const v = ind.fxReserves.values;
    const c = card(page, "fxReserves");
    // The two SBP-published rows are the card's only figure rows…
    await expect(c.locator("dl dd")).toHaveCount(2);
    const t = await text("fxReserves");
    expect(t).toContain(`Net reserves held by SBP ${fmt(v.sbpNetMillionUsd)} million USD`);
    expect(t).toContain(`Net reserves held by commercial banks ${fmt(v.banksNetMillionUsd)} million USD`);
    // …and the computed total sits apart, marked, with the API's formula.
    const computed = c.locator("div.border-dashed");
    await expect(computed).toContainText("Computed");
    await expect(computed).toContainText(`${fmt(v.total.millionUsd)} million USD`);
    await expect(computed).toContainText("Calculated by AZEE, not published by SBP");
    await expect(computed).toContainText(v.total.formula);
  }

  if (ind.trade.status !== "unavailable") {
    const v = ind.trade.values;
    const t = await text("trade");
    expect(t).toContain(`Exports ${fmt(v.exportsMillionUsd)} million USD`);
    expect(t).toContain(`Imports ${fmt(v.importsMillionUsd)} million USD`);
    expect(t).toContain(`${fmt(v.balanceMillionUsd)} million USD`);
  }

  if (ind.remittances.status !== "unavailable") {
    expect(await text("remittances")).toContain(`Inflow ${fmt(ind.remittances.values.inflowMillionUsd)} million USD`);
  }

  if (ind.externalDebt.status !== "unavailable") {
    expect(await text("externalDebt")).toContain(`${fmt(ind.externalDebt.values.totalMillionUsd)} million USD`);
  }

  if (ind.debtServicing.status !== "unavailable") {
    const v = ind.debtServicing.values;
    const c = card(page, "debtServicing");
    // Exactly the three SBP subtotals, and nothing that adds them up.
    await expect(c.locator("dl dd")).toHaveCount(3);
    const t = await text("debtServicing");
    expect(t).toContain(`Long-term principal payments ${fmt(v.longTermPrincipalMillionUsd)} million USD`);
    expect(t).toContain(`Short-term principal payments ${fmt(v.shortTermPrincipalMillionUsd)} million USD`);
    expect(t).toContain(`Interest payments ${fmt(v.interestMillionUsd)} million USD`);
    expect(t).not.toMatch(/total/i);
    const sum = fmt(v.longTermPrincipalMillionUsd + v.shortTermPrincipalMillionUsd + v.interestMillionUsd);
    expect(await main.innerText()).not.toContain(sum);
  }

  expect(errors).toEqual([]);
});

test("before the first daily run, says so instead of rendering an empty dashboard", async ({ page }) => {
  const errors = watchConsole(page);
  await serve(page, 200, {
    status: "pending",
    message: "Economic indicators have not been fetched yet. They are collected from SBP EasyData once a day and will appear after the first daily update.",
  });
  await page.goto("/economic-dashboard");

  const main = page.locator("main");
  await expect(main).toContainText("Awaiting first update");
  await expect(main).toContainText("Economic indicators have not been fetched yet");
  await expect(main).toContainText("No figures are shown until then");
  await expect(main.locator("article")).toHaveCount(0);
  await expect(main).not.toContainText("Last collected from SBP EasyData");
  expect(errors).toEqual([]);
});

test("stale and unavailable indicators are visibly distinct from fresh ones", async ({ page }) => {
  const errors = watchConsole(page);
  await serve(page, 200, DEGRADED);
  await page.goto("/economic-dashboard");
  await expect(page.locator("main article")).toHaveCount(9);

  // Stale: the last confirmed figures stay, dimmed, marked, with since-when.
  const stale = card(page, "cpi");
  await expect(stale).toContainText("Not current");
  await expect(stale).toContainText("11.1%");
  await expect(stale).toContainText("Showing the last confirmed figures");
  await expect(stale).toContainText("since 12 Sep");
  const staleOpacity = await stale.locator("table").evaluate((el) => getComputedStyle(el.parentElement!.parentElement!).opacity);
  expect(Number(staleOpacity)).toBeLessThan(1);

  // Unavailable: its own state — no figure, no source link, no blank.
  const unavailable = card(page, "gdpQuarterly");
  await expect(unavailable).toContainText("Not yet available");
  await expect(unavailable).toContainText("there is no figure to show");
  await expect(unavailable).not.toContainText("%");
  await expect(unavailable.getByRole("link")).toHaveCount(0);

  // Fresh cards carry neither marker and are not dimmed.
  for (const key of ["policyRate", "gdpAnnual", "fxReserves", "debtServicing"] as Key[]) {
    const c = card(page, key);
    await expect(c).not.toContainText("Not current");
    await expect(c).not.toContainText("Not yet available");
    const opacity = await c.locator("dl").first().evaluate((el) => getComputedStyle(el.parentElement!).opacity);
    expect(Number(opacity), key).toBe(1);
  }

  expect(errors).toEqual([]);
});

test("an API outage says the indicators are unavailable, with no figures", async ({ page }) => {
  const errors = watchConsole(page);
  await serve(page, 503, { error: "Economic data is temporarily unavailable" });
  await page.goto("/economic-dashboard");

  const main = page.locator("main");
  await expect(main).toContainText("Economic indicators are temporarily unavailable. Please try again shortly.");
  await expect(main.locator("article")).toHaveCount(0);
  await expect(main).not.toContainText("Loading economic indicators");

  /*
   * Chromium itself logs the refused request ("Failed to load resource:
   * … status of 503") — that line is the outage this test staged, not a
   * page fault, so it alone is excused. Anything else still fails.
   */
  const unexpected = errors.filter(
    (e) => !(/Failed to load resource: the server responded with a status of 503/.test(e) && e.includes("/api/economic/dashboard")),
  );
  expect(unexpected).toEqual([]);
});
