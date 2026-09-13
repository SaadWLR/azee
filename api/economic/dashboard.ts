import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CpiValues,
  DebtServicingValues,
  EconomicDashboardPending,
  EconomicDashboardReady,
  EconomicIndicators,
  ExternalDebtValues,
  FxReservesValues,
  GdpGrowthValues,
  Indicator,
  IndicatorFrequency,
  IndicatorReading,
  PolicyRateValues,
  RemittancesValues,
  TradeValues,
} from "../../src/types/economic-dashboard";

/**
 * GET /api/economic/dashboard
 *
 * Pakistan's headline macro indicators for /economic-dashboard, read
 * from SBP EasyData. ONE function with two jobs, told apart by who is
 * calling:
 *
 *  - WRITE — Vercel Cron, carrying `Authorization: Bearer $CRON_SECRET`
 *    (the same signature check record-breadth.ts relies on). Fetches the
 *    nine SBP pages, parses them, and stores one snapshot in KV.
 *  - READ — any request with no Authorization header at all, i.e. every
 *    page load. Serves that snapshot straight from KV and never contacts
 *    SBP, so a visitor costs SBP nothing and an SBP outage can't slow the
 *    page down.
 *  - 401 — an Authorization header that doesn't match. That is a failed
 *    auth attempt rather than a reader, and it is refused so it shows up
 *    (for instance a CRON_SECRET that has drifted from the one Vercel
 *    signs with) instead of quietly being handed the snapshot.
 *
 * Unlike record-breadth.ts, a request WITHOUT credentials is not refused:
 * it is simply a reader. When CRON_SECRET is absent nothing can match, so
 * the route can never write — it never defaults open.
 *
 * RUNTIME: Node. EasyData's /apex/ pages were probed live from a Vercel
 * preview (Sep 2026) and returned clean 200s with real figures from the
 * Node runtime. Its / and /api/ paths sit behind a Cloudflare rule that
 * blocks Node clients, which is why this reads the server-rendered pages
 * and never the EasyData API (which would also need a 90-day key). The
 * pages are addressed by EasyData's own checksummed URLs: APEX rejects
 * hand-built ones with a "session state protection violation" page that
 * still answers 200, so that text is checked for explicitly.
 *
 * ADAPTER IS INLINED. Vercel bundles each function in `api/`
 * separately, so runtime imports between them don't resolve — the KV
 * helper is a copy of record-breadth.ts's, and the type imports above are
 * import-type only and vanish at build.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

/*
 * SCHEDULE: "0 14 * * *" in vercel.json — 14:00 UTC is 19:00 PKT, every
 * day. SBP releases land during Pakistan's working day (weekly reserves,
 * monthly balance of payments and remittances, a policy rate on MPC
 * day), so an evening run picks up a same-day release the same day, and
 * Hobby's ±59-minute cron precision still keeps it after office hours.
 * Three hours clear of record-breadth's 11:00 UTC run, so the two never
 * share a log window. Weekends included: nothing is released then, but a
 * missed weekday tick then costs at most a day rather than a weekend.
 * Daily is also Hobby's floor, and more than these series need — the
 * fastest of them, reserves, moves weekly.
 *
 * This lives here rather than beside the entry because vercel.json is
 * schema-validated and rejects comment keys (see record-breadth.ts).
 */

/** One snapshot for all nine indicators, colon-separated like the other keys. */
const KV_KEY = "economic:dashboard";

const EASYDATA = "https://easydata.sbp.org.pk/apex/";

/*
 * The nine pages, as EasyData itself links them: page 220 renders one
 * series' latest observations, page 211 a whole dataset's series with
 * their last six periods. Session 0 and no cookie — the `cs` checksums
 * are application-level, verified to work cold.
 */
const PAGES = {
  policyRate: `${EASYDATA}f?p=10:220:0::NO:RP:P220_SERIES_KEY,P220_PAGE_ID:TS_GP_IR_SIRPR_AH.SBPOL0030,1&cs=13D7590643363136B3450AEAF0AD26B0F`,
  cpi: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_PT_CPI_M,250&cs=1FE05C0C45F0634A6B6B0D713DEABA7B5`,
  gdpAnnual: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_RLS_PAKGDP15_Y,250&cs=1C074C539DEE45561A1B7BB7AF1984925`,
  gdpQuarterly: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_RS_QGDP1516_Q,250&cs=174F22DDAD6A4907C011565ADD73166D5`,
  fxReserves: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_EXT_PAKRES_M,250&cs=110234795008534EEC3F4AF864E4AA0FA`,
  externalDebt: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_ED_PKEDLOUT_Q,250&cs=13E426B9670422967C60205D728B67D49`,
  debtServicing: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_ED_PKEDLSER_Q,250&cs=1B397C80D4E713EBFADF8D5B57CB707CA`,
  trade: `${EASYDATA}f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_BOP_BPM6SUM_M,250&cs=195EC35589875E64981F7BAF0BAFDC5C2`,
  remittances: `${EASYDATA}f?p=10:220:0::NO:RP:P220_SERIES_KEY,P220_PAGE_ID:TS_GP_BOP_WR_M.WR0340,1&cs=1B95E07DAC54300CB4A05B1C40048156D`,
} as const satisfies Record<keyof EconomicIndicators, string>;

/** Per page. The nine run in parallel, so this also bounds the whole fetch phase. */
const PAGE_TIMEOUT_MS = 15_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ── KV ────────────────────────────────────────────────────────────── */

async function kv(
  path: string,
  init?: RequestInit,
): Promise<{ result?: string | null }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV is not configured");
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`KV responded ${response.status}`);
  return (await response.json()) as { result?: string | null };
}

/* ── EasyData page parsing ─────────────────────────────────────────── */

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (economic dashboard)",
    },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SBP responded ${response.status}`);
  const html = await response.text();
  // Both of these arrive as HTTP 200, so the status alone proves nothing.
  if (/Session state protection violation/i.test(html)) {
    throw new Error("EasyData rejected the page checksum (session state protection)");
  }
  if (/Sorry, you have been blocked/i.test(html)) {
    throw new Error("Cloudflare blocked the request");
  }
  return html;
}

function cellText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .trim();
}

/**
 * An EasyData number, or null for its "-" empty cell. Accepts the
 * leading-dot form it prints (".5", "-.21"). Anything else throws: a
 * value cell that isn't a number means the page changed shape, and a
 * misread figure is worse than a stale one.
 */
function sbpNumber(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (t === "" || t === "-") return null;
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) {
    throw new Error(`unreadable value "${t.slice(0, 40)}"`);
  }
  return Number(t);
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/**
 * The ISO date an EasyData period label ends on. "Aug-2026" → the last
 * day of that month (a quarter is labelled by its final month, so the
 * same rule covers it); "28-Apr-2026" → that day; "2026" → 30 June 2026,
 * because EasyData's annual GDP is by fiscal year — its own page cites
 * the series as running "30-Jun-2000 to 30-Jun-2026".
 */
function periodEnd(label: string): string {
  const day = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/.exec(label);
  if (day && MONTHS[day[2]]) {
    return `${day[3]}-${String(MONTHS[day[2]]).padStart(2, "0")}-${day[1]}`;
  }
  const month = /^([A-Z][a-z]{2})-(\d{4})$/.exec(label);
  if (month && MONTHS[month[1]]) {
    const lastDay = new Date(Date.UTC(Number(month[2]), MONTHS[month[1]], 0));
    return lastDay.toISOString().slice(0, 10);
  }
  if (/^\d{4}$/.test(label)) return `${label}-06-30`;
  throw new Error(`unrecognised period label "${label}"`);
}

interface DatasetSeries {
  key: string;
  name: string;
  unit: string;
  /** In page (column) order — oldest to newest. */
  observations: { label: string; value: number | null }[];
}

/**
 * One series' row from a dataset page (211). Every value cell names its
 * own period in a `headers` attribute (headers="Aug-2026"), so values are
 * matched to periods by the page's own labelling rather than by column
 * position.
 */
function datasetSeries(html: string, key: string, unit: string): DatasetSeries {
  const marker = `alt="Series Key = ${key}"`;
  const row = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []).find((r) =>
    r.includes(marker),
  );
  if (!row) throw new Error(`${key} is missing from its dataset page`);

  const cells = [
    ...row.matchAll(/<td[^>]*\bheaders="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g),
  ].map(([, header, inner]) => ({ header, text: cellText(inner) }));

  const foundUnit = cells.find((c) => c.header === "Unit")?.text;
  // A changed unit means a changed series — refuse rather than mislabel.
  if (foundUnit !== unit) {
    throw new Error(`${key} unit is "${foundUnit}", expected "${unit}"`);
  }
  const observations = cells
    .filter((c) => /^(?:[A-Z][a-z]{2}-\d{4}|\d{4})$/.test(c.header))
    .map((c) => ({ label: c.header, value: sbpNumber(c.text) }));
  if (observations.length === 0) {
    throw new Error(`${key} has no period columns`);
  }
  return {
    key,
    name: cells.find((c) => c.header === "Series Name")?.text ?? key,
    unit: foundUnit,
    observations,
  };
}

/**
 * The newest period in which EVERY given series has a value, with those
 * values in argument order. Multi-series indicators are always read from
 * one common period, so a total, a balance or a headline/core pair never
 * mixes months.
 */
function latestCommon(series: DatasetSeries[]): { label: string; values: number[] } {
  const labels = series[0].observations.map((o) => o.label);
  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i];
    const values = series.map(
      (s) => s.observations.find((o) => o.label === label)?.value ?? null,
    );
    if (values.every((v): v is number => v !== null)) return { label, values };
  }
  throw new Error(
    `no period with values for all of ${series.map((s) => s.key).join(", ")}`,
  );
}

/**
 * The newest observation on a single-series page (220): rows of
 * headers="PERIOD" / headers="OBSERVATION" cells, the value carrying its
 * unit ("11.5 Percent"). The newest is chosen by date, not row order.
 */
function seriesLatest(html: string, unit: string): { label: string; value: number } {
  const rows = [
    ...html.matchAll(
      /headers="PERIOD">([^<]+)<\/td>\s*<td[^>]*headers="OBSERVATION">([^<]+)<\/td>/g,
    ),
  ];
  let best: { label: string; value: number; end: string } | null = null;
  for (const [, rawLabel, rawObservation] of rows) {
    const label = rawLabel.trim();
    const observation = rawObservation.trim();
    if (!observation.endsWith(` ${unit}`)) {
      throw new Error(`observation "${observation.slice(0, 40)}" is not in ${unit}`);
    }
    const value = sbpNumber(observation.slice(0, -unit.length - 1));
    if (value === null) continue;
    const end = periodEnd(label);
    if (!best || end > best.end) best = { label, value, end };
  }
  if (!best) throw new Error("no observations on the series page");
  return { label: best.label, value: best.value };
}

/**
 * Outer sanity bounds. Not claims about what these indicators can do —
 * claims that a parse landing outside them is far more likely a column
 * shift or a page change than real data (the same role
 * MAX_PLAUSIBLE_DERIVATIVES_RATIO plays in record-breadth.ts).
 */
function plausible(label: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} ${value} is outside a plausible range [${min}, ${max}]`);
  }
  return value;
}

/* ── The nine indicators ───────────────────────────────────────────── */

type Parsed<T> = Omit<IndicatorReading<T>, "fetchedAt" | "frequency" | "source"> & {
  seriesKeys: string[];
};

interface IndicatorSpec<T> {
  frequency: IndicatorFrequency;
  parse(html: string): Parsed<T>;
}

function reading<T>(label: string, values: T, seriesKeys: string[]): Parsed<T> {
  return { periodLabel: label, asOf: periodEnd(label), values, seriesKeys };
}

const policyRate: IndicatorSpec<PolicyRateValues> = {
  frequency: "as-needed",
  parse(html) {
    const { label, value } = seriesLatest(html, "Percent");
    const date = periodEnd(label);
    /*
     * The series records only CHANGES (verified: every consecutive
     * observation differs), so its newest date is the date of the last
     * policy rate change. That is what gets stored as lastChangeDate —
     * not "last MPC decision", which a hold would leave unrecorded here.
     */
    return reading(
      label,
      { ratePercent: plausible("policy rate", value, 0, 50), lastChangeDate: date },
      ["TS_GP_IR_SIRPR_AH.SBPOL0030"],
    );
  },
};

const cpi: IndicatorSpec<CpiValues> = {
  frequency: "monthly",
  parse(html) {
    /*
     * National headline, and core as SBP measures it: non-food
     * non-energy (NFNE), published separately for urban and rural CPI.
     * EasyData lists the rural rows as indented children of the urban
     * ones (P00131516 under NFNE-YoY-Urban, P00581516 under
     * NFNE-MoM-Urban).
     */
    const keys = {
      headlineYoy: "TS_GP_PT_CPI_M.P00011516",
      headlineMom: "TS_GP_PT_CPI_M.P00461516",
      urbanYoy: "TS_GP_PT_CPI_M.P00121516",
      urbanMom: "TS_GP_PT_CPI_M.P00571516",
      ruralYoy: "TS_GP_PT_CPI_M.P00131516",
      ruralMom: "TS_GP_PT_CPI_M.P00581516",
    };
    const order = Object.values(keys);
    const { label, values } = latestCommon(
      order.map((k) => datasetSeries(html, k, "Percent")),
    );
    // Even positions are year-on-year, odd are month-on-month.
    const [hy, hm, uy, um, ry, rm] = values.map((v, i) =>
      plausible(order[i], v, -20, i % 2 === 0 ? 100 : 30),
    );
    return reading(
      label,
      {
        headline: { yoyPercent: hy, momPercent: hm },
        core: {
          measure: "NFNE",
          urban: { yoyPercent: uy, momPercent: um },
          rural: { yoyPercent: ry, momPercent: rm },
        },
      },
      order,
    );
  },
};

function gdpGrowth(key: string): IndicatorSpec<GdpGrowthValues>["parse"] {
  return (html) => {
    const { label, values } = latestCommon([datasetSeries(html, key, "Percent")]);
    return reading(
      label,
      { growthPercent: plausible("GDP growth", values[0], -30, 30) },
      [key],
    );
  };
}

const gdpAnnual: IndicatorSpec<GdpGrowthValues> = {
  frequency: "fiscal-year",
  // "A. Growth Rate of Real Gross Domestic Product", constant 2015-16 prices.
  parse: gdpGrowth("TS_GP_RLS_PAKGDP15_Y.GDP00160000"),
};

const gdpQuarterly: IndicatorSpec<GdpGrowthValues> = {
  frequency: "quarterly",
  // "B. Growth Rate of Gross Domestic Product (Total of Gross Value Addition at Constant Factor Cost(2015-16))".
  parse: gdpGrowth("TS_GP_RS_QGDP1516_Q.QGDP00080000"),
};

const fxReserves: IndicatorSpec<FxReservesValues> = {
  frequency: "monthly",
  parse(html) {
    /*
     * SBP's page defines its total liquid reserves as row 19 = 2 + 10:
     * "Net Reserves with SBP (2)" plus "Net Reserves With Banks (10)".
     * Its own series for that total (Z00060) prints "-" in every column,
     * so the total is computed from exactly those two published rows, in
     * the same period, and flagged computed — never presented as a
     * figure SBP itself released.
     */
    const sbpKey = "TS_GP_EXT_PAKRES_M.Z00030";
    const banksKey = "TS_GP_EXT_PAKRES_M.Z00050";
    const { label, values } = latestCommon([
      datasetSeries(html, sbpKey, "Million USD"),
      datasetSeries(html, banksKey, "Million USD"),
    ]);
    const sbp = plausible("SBP net reserves", values[0], -50_000, 200_000);
    const banks = plausible("banks' net reserves", values[1], -50_000, 200_000);
    return reading(
      label,
      {
        sbpNetMillionUsd: sbp,
        banksNetMillionUsd: banks,
        total: {
          millionUsd: round2(sbp + banks),
          computed: true,
          formula:
            "Net reserves with SBP + net reserves with banks — SBP's own definition of total liquid FX reserves (row 19 = 2 + 10), whose published series (TS_GP_EXT_PAKRES_M.Z00060) is empty on EasyData",
        },
      },
      [sbpKey, banksKey],
    );
  },
};

const externalDebt: IndicatorSpec<ExternalDebtValues> = {
  frequency: "quarterly",
  parse(html) {
    const key = "TS_GP_ED_PKEDLOUT_Q.STO00570";
    const { label, values } = latestCommon([datasetSeries(html, key, "Million USD")]);
    return reading(
      label,
      { totalMillionUsd: plausible("external debt", values[0], 10_000, 1_000_000) },
      [key],
    );
  },
};

const debtServicing: IndicatorSpec<DebtServicingValues> = {
  frequency: "quarterly",
  parse(html) {
    /*
     * The three subtotals SBP publishes, and deliberately no sum of them.
     * Checked against Jun-2026: long-term principal (8,591.53) is exactly
     * the sum of its seven categories and total interest (1,329.32) of
     * its seven, but short-term principal (215.81) is government plus
     * private non-guaranteed only (211.11 + 4.70) — scheduled banks'
     * borrowing (8,504.08, with its net flows beside it) sits outside it.
     * Adding the three would produce a number SBP never published and
     * that cannot be vouched for, so no total field exists.
     */
    const keys = [
      "TS_GP_ED_PKEDLSER_Q.DS00300",
      "TS_GP_ED_PKEDLSER_Q.DS00310",
      "TS_GP_ED_PKEDLSER_Q.DS00860",
    ];
    const { label, values } = latestCommon(
      keys.map((k) => datasetSeries(html, k, "Million USD")),
    );
    const [longTerm, shortTerm, interest] = values.map((v, i) =>
      plausible(keys[i], v, 0, 100_000),
    );
    return reading(
      label,
      {
        longTermPrincipalMillionUsd: longTerm,
        shortTermPrincipalMillionUsd: shortTerm,
        interestMillionUsd: interest,
      },
      keys,
    );
  },
};

const trade: IndicatorSpec<TradeValues> = {
  frequency: "monthly",
  parse(html) {
    const keys = [
      "TS_GP_BOP_BPM6SUM_M.P00030",
      "TS_GP_BOP_BPM6SUM_M.P00040",
      "TS_GP_BOP_BPM6SUM_M.P00050",
    ];
    const { label, values } = latestCommon(
      keys.map((k) => datasetSeries(html, k, "Million USD")),
    );
    const exports = plausible("exports", values[0], 0, 100_000);
    const imports = plausible("imports", values[1], 0, 100_000);
    const balance = plausible("trade balance", values[2], -100_000, 100_000);
    /*
     * The balance is SBP's own published figure, not derived here — but
     * it must agree with exports minus imports. SBP prints these rounded
     * to whole millions, so a mismatch beyond that is a misread row.
     */
    if (Math.abs(exports - imports - balance) > Math.max(2, imports * 0.005)) {
      throw new Error(
        `trade rows disagree: ${exports} - ${imports} != ${balance}`,
      );
    }
    return reading(
      label,
      {
        exportsMillionUsd: exports,
        importsMillionUsd: imports,
        balanceMillionUsd: balance,
        basis: "balance-of-payments-goods",
      },
      keys,
    );
  },
};

const remittances: IndicatorSpec<RemittancesValues> = {
  frequency: "monthly",
  parse(html) {
    // The observation cells say "Million USD"; the page's metadata row
    // says "USD". The cells, which sit beside the numbers, are what's checked.
    const { label, value } = seriesLatest(html, "Million USD");
    return reading(
      label,
      { inflowMillionUsd: plausible("remittances", value, 0, 50_000) },
      ["TS_GP_BOP_WR_M.WR0340"],
    );
  },
};

const SPECS: { [K in keyof EconomicIndicators]: IndicatorSpec<ValuesOf<K>> } = {
  policyRate,
  cpi,
  gdpAnnual,
  gdpQuarterly,
  fxReserves,
  externalDebt,
  debtServicing,
  trade,
  remittances,
};

type ValuesOf<K extends keyof EconomicIndicators> =
  EconomicIndicators[K] extends Indicator<infer T> ? T : never;

/* ── Write path ────────────────────────────────────────────────────── */

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

/**
 * One indicator for this run.
 *
 * Success replaces it outright. Failure NEVER blanks it: the previous
 * reading is carried forward with status "stale" — its values, its asOf
 * and its original fetchedAt all untouched — and `staleSince` keeps the
 * FIRST failure of the streak, so a week-long outage reads as a week. An
 * indicator that has never once been read stays "unavailable".
 */
async function refreshIndicator<K extends keyof EconomicIndicators>(
  key: K,
  previous: EconomicIndicators[K] | undefined,
  attemptAt: string,
): Promise<EconomicIndicators[K]> {
  const spec = SPECS[key];
  try {
    const { seriesKeys, ...parsed } = spec.parse(await fetchPage(PAGES[key]));
    return {
      status: "fresh",
      ...parsed,
      frequency: spec.frequency,
      source: { url: PAGES[key], seriesKeys },
      fetchedAt: new Date().toISOString(),
    } as EconomicIndicators[K];
  } catch (error) {
    const lastError = errorMessage(error);
    console.error(`Economic dashboard: ${key} could not be refreshed:`, lastError);
    Sentry.captureException(error);
    const prior = previous as Indicator<unknown> | undefined;
    if (prior && prior.status !== "unavailable") {
      return {
        ...prior,
        status: "stale",
        staleSince: prior.status === "stale" ? prior.staleSince : attemptAt,
        lastAttemptAt: attemptAt,
        lastError,
      } as EconomicIndicators[K];
    }
    return {
      status: "unavailable",
      lastAttemptAt: attemptAt,
      lastError,
    } as EconomicIndicators[K];
  }
}

async function write(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  const attemptAt = new Date().toISOString();

  /*
   * The previous snapshot is what failed indicators are carried forward
   * from. If it can't be READ, writing anyway would overwrite every
   * carried-forward figure with "unavailable" — so the run stops here
   * and the stored snapshot stays exactly as it was.
   */
  let previous: EconomicDashboardReady | null;
  try {
    const raw = (await kv(`/get/${KV_KEY}`)).result;
    previous = raw ? (JSON.parse(raw) as EconomicDashboardReady) : null;
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ written: false, error: "Could not read the stored snapshot" });
    return;
  }

  const keys = Object.keys(SPECS) as (keyof EconomicIndicators)[];
  const refreshed: Indicator<unknown>[] = await Promise.all(
    keys.map((key) => refreshIndicator(key, previous?.indicators[key], attemptAt)),
  );
  const indicators = Object.fromEntries(
    keys.map((key, i) => [key, refreshed[i]]),
  ) as unknown as EconomicIndicators;

  // What the cron log shows: status per indicator, never the figures.
  const summary = Object.fromEntries(
    keys.map((key, i) => {
      const entry = refreshed[i];
      return [
        key,
        entry.status === "fresh"
          ? { status: entry.status, asOf: entry.asOf }
          : { status: entry.status, error: entry.lastError },
      ];
    }),
  );
  const freshCount = refreshed.filter((r) => r.status === "fresh").length;

  /*
   * In-function runtime marker, answered only to the signed cron call.
   * Deployment metadata lists Edge functions as Node lambdas too, so this
   * is the proof of which runtime actually ran: Node exposes
   * process.versions.node, the Edge runtime defines EdgeRuntime.
   */
  const runtime = {
    node: typeof process !== "undefined" ? process.versions?.node ?? null : null,
    edgeRuntime: (globalThis as { EdgeRuntime?: string }).EdgeRuntime ?? null,
  };

  // Nothing stored yet and nothing read: writing would replace an honest
  // "pending" with a snapshot of nine blanks. Leave it pending, and fail
  // loudly enough to show in the cron log.
  if (!previous && freshCount === 0) {
    res.status(502).json({ written: false, indicators: summary, runtime });
    return;
  }

  const snapshot: EconomicDashboardReady = {
    status: "ready",
    source: "sbp-easydata",
    updatedAt: attemptAt,
    indicators,
  };
  try {
    await kv(`/set/${KV_KEY}`, {
      method: "POST",
      body: JSON.stringify(snapshot),
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ written: false, error: "Could not store the snapshot", indicators: summary, runtime });
    return;
  }

  // 502 when every SBP read failed (the carried-forward snapshot was
  // still stored, so its staleness is visible to readers); 200 otherwise.
  res
    .status(freshCount === 0 ? 502 : 200)
    .json({ written: true, updatedAt: attemptAt, freshCount, indicators: summary, runtime });
}

/* ── Read path ─────────────────────────────────────────────────────── */

const PENDING: EconomicDashboardPending = {
  status: "pending",
  message:
    "Economic indicators have not been fetched yet. They are collected from SBP EasyData once a day and will appear after the first daily update.",
};

async function read(res: VercelResponse) {
  /*
   * Vary: Authorization keeps a cached public read from ever being
   * served to the cron's signed request. Vercel's CDN documents that it
   * won't CACHE a request carrying Authorization, but not that it won't
   * SERVE a cached response to one — and if it did, the daily write
   * would silently never run. Only requests with no Authorization reach
   * this path (the handler writes or refuses the rest), so every reader
   * still shares one cache entry.
   */
  res.setHeader("Vary", "Authorization");

  let raw: string | null | undefined;
  try {
    raw = (await kv(`/get/${KV_KEY}`)).result;
  } catch (error) {
    console.error("Economic dashboard read failed:", errorMessage(error));
    Sentry.captureException(error);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: "Economic data is temporarily unavailable" });
    return;
  }

  if (!raw) {
    /*
     * Five minutes, not hours: this is the one state that is guaranteed
     * to end, the moment the first daily run lands, and it should not
     * outlive that by the full snapshot window below.
     */
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(PENDING);
    return;
  }

  let snapshot: EconomicDashboardReady;
  try {
    snapshot = JSON.parse(raw) as EconomicDashboardReady;
  } catch (error) {
    Sentry.captureException(error);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: "Economic data is temporarily unavailable" });
    return;
  }

  /*
   * s-maxage=10800 (3 hours), stale-while-revalidate=86400.
   *
   * The snapshot changes at most once a day — only the 19:00 PKT cron
   * writes it — and the underlying series move weekly (reserves) to
   * quarterly (GDP, debt). A read costs one KV GET and nothing upstream,
   * so this window is not protecting SBP; it keeps KV reads to a few per
   * region per day. Three hours caps how long a fresh daily run can take
   * to reach readers well inside the same evening, and the day-long
   * stale-while-revalidate means a revalidation — never a visitor —
   * pays for the KV round trip once the window lapses.
   */
  res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=86400");
  res.status(200).json(snapshot);
}

/* ── HTTP handler ──────────────────────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /*
   * Three cases, decided by the Authorization header alone:
   *
   *  - absent → read. The frontend never sends one.
   *  - `Bearer ${CRON_SECRET}` → write. Vercel signs its cron invocations
   *    this way, exactly as for record-breadth.ts.
   *  - present but anything else → 401. Someone attempted auth and it
   *    failed; serving them the snapshot would hide that. This includes
   *    an empty header, a non-Bearer scheme, and every header when
   *    CRON_SECRET isn't configured — with nothing to match against, no
   *    attempt can succeed, so the route never defaults open.
   */
  const authorization = req.headers.authorization;
  if (authorization === undefined) {
    await read(res);
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (secret && authorization === `Bearer ${secret}`) {
    await write(res);
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("WWW-Authenticate", "Bearer");
  res.status(401).json({ error: "Unauthorized" });
}
