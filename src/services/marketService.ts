import { apiGet, mockResponse } from "../lib/apiClient";
import type { ForexResponse } from "../types/forex";
import type {
  EtfQuote,
  EtfsResponse,
  FullIndexQuote,
  FullIndicesResponse,
  GlobalFuturesQuote,
  GlobalFuturesResponse,
  PmexCommoditiesResponse,
  PmexCommodityQuote,
  IndexConstituent,
  IndexConstituentsResponse,
  MarketIndexQuote,
  MarketIndicesResponse,
  MarketSnapshot,
  MarketStat,
  MarketWatchResponse,
  StockQuote,
} from "../types";

/*
 * Fixtures reflect actual early-July-2026 PSX sessions (KSE-100 close
 * of Jul 6, 2026). Replace each mockResponse with apiGet against the
 * live feed (e.g. the PSX data portal at dps.psx.com.pk or a broker
 * market-data service) — payload shapes are already aligned.
 */

/** Development fixture — production always serves live PSX data. */
const MARKET_SNAPSHOT: MarketSnapshot = {
  index: {
    name: "KSE-100 Index",
    value: 187454.64,
    changePercent: 1.12,
    changePoints: 2082.49,
    direction: "up",
  },
  status: "OPEN",
  timestamp: "Karachi · PKT",
};

/**
 * Development fixture for /api/market/indices — the five PSX benchmark
 * indices (KSE-100 matches MARKET_SNAPSHOT above). Production always
 * serves live PSX data; these plausible values only exist so the panel
 * renders under `vite dev`, where the serverless route doesn't run.
 */
const MARKET_INDICES: MarketIndexQuote[] = [
  { code: "KSE100", name: "KSE-100", value: 187454.64, changePercent: 1.12, changePoints: 2082.49, direction: "up", asOf: "" },
  { code: "KSE30", name: "KSE-30", value: 57340.12, changePercent: 0.94, changePoints: 534.6, direction: "up", asOf: "" },
  { code: "ALLSHR", name: "KSE All Share", value: 117980.55, changePercent: 0.88, changePoints: 1029.3, direction: "up", asOf: "" },
  { code: "KMI30", name: "KMI-30", value: 271560.4, changePercent: 1.04, changePoints: 2795.1, direction: "up", asOf: "" },
  { code: "KMIALLSHR", name: "KMI All Share", value: 78420.18, changePercent: 0.71, changePoints: 553.0, direction: "up", asOf: "" },
];

/**
 * Development fixture for /api/market/indices-full — the 10 PSX
 * benchmark indices with high/low/change/volume (plausible values from
 * a real Jul 2026 session). Production always serves live PSX data;
 * these exist only so the /indices page renders under `vite dev`, where
 * the serverless route doesn't run. No value/turnover field — it isn't
 * a real PSX metric (see the endpoint).
 */
const FULL_INDICES: FullIndexQuote[] = [
  { code: "KSE100", name: "KSE-100 Index", value: 176133.56, high: 178370.45, low: 176062.69, changePoints: 205.83, changePercent: 0.12, direction: "up", volume: 448767016 },
  { code: "KSE30", name: "KSE-30 Index", value: 52663.9, high: 53395.41, low: 52629.57, changePoints: 48.09, changePercent: 0.09, direction: "up", volume: 106374502 },
  { code: "ALLSHR", name: "KSE All Share Index", value: 106568.82, high: 107857.74, low: 106600, changePoints: 149.03, changePercent: 0.14, direction: "up", volume: 1000676668 },
  { code: "KMI30", name: "KMI-30 Index", value: 247838.41, high: 251801.8, low: 247707.33, changePoints: 22.06, changePercent: 0.01, direction: "up", volume: 145607022 },
  { code: "KMIALLSHR", name: "KMI All Share Index", value: 68255.8, high: 69163.33, low: 68237.33, changePoints: 23.11, changePercent: 0.03, direction: "up", volume: 586069192 },
  { code: "PSXDIV20", name: "PSX Dividend 20 Index", value: 81542, high: 82487.88, low: 81508.55, changePoints: 211.13, changePercent: 0.26, direction: "up", volume: 35260948 },
  { code: "BKTI", name: "Banking Tradable Index", value: 50243.89, high: 50808.59, low: 50154.2, changePoints: 158.69, changePercent: 0.32, direction: "up", volume: 28247537 },
  { code: "OGTI", name: "Oil & Gas Tradable Index", value: 34622.41, high: 35221.12, low: 34589.95, changePoints: -120.21, changePercent: -0.35, direction: "down", volume: 7250801 },
  { code: "UPP9", name: "UBL Pakistan Enterprise Index", value: 62973.32, high: 63796.74, low: 62922.37, changePoints: 197.4, changePercent: 0.31, direction: "up", volume: 12436207 },
  { code: "NITPGI", name: "NIT Pakistan Gateway Index", value: 46622.29, high: 47201.51, low: 46577.3, changePoints: 96, changePercent: 0.21, direction: "up", volume: 20403831 },
];

/**
 * Development fixture mirroring /api/market/watch's stats array
 * (values from the real Jul 10, 2026 session) — production always
 * serves live PSX data.
 */
const WATCH_STATS: MarketStat[] = [
  { label: "Market Volume", value: "948.7M shares" },
  { label: "Advancers", value: "291", direction: "up" },
  { label: "Decliners", value: "170", direction: "down" },
  { label: "Symbols Traded", value: "494" },
];

/** Liquid PSX main-board symbols for the ticker tape. */
const TICKER_QUOTES: StockQuote[] = [
  { symbol: "OGDC", price: 226.4, changePercent: 1.84 },
  { symbol: "HBL", price: 142.75, changePercent: 2.1 },
  { symbol: "LUCK", price: 1148.0, changePercent: 0.92 },
  { symbol: "ENGRO", price: 318.5, changePercent: -0.41 },
  { symbol: "UBL", price: 372.2, changePercent: 1.47 },
  { symbol: "PSO", price: 384.1, changePercent: -1.18 },
  { symbol: "MEBL", price: 342.8, changePercent: 0.73 },
  { symbol: "FFC", price: 438.25, changePercent: 1.06 },
  { symbol: "SYS", price: 1924.0, changePercent: 2.38 },
  { symbol: "MARI", price: 692.3, changePercent: -0.64 },
  { symbol: "TRG", price: 64.85, changePercent: 3.21 },
  { symbol: "POL", price: 598.4, changePercent: 0.35 },
];

/**
 * Development fixture for the full Market Watch table — a
 * representative slice with all fields (change points + volume)
 * populated, so sort/filter/search all work locally. Production
 * serves the real ~490-symbol table from /api/market/watch. Note the
 * limits of the underlying PSX source: symbols only (no company
 * names), no sector names, no fundamentals — the page never
 * fabricates those.
 */
const MARKET_WATCH_FULL: StockQuote[] = [
  { symbol: "OGDC", price: 226.4, changePercent: 1.84, changePoints: 4.09, volume: 12734500, isKmi30: true, isKmiAllShare: true },
  { symbol: "HBL", price: 142.75, changePercent: 2.1, changePoints: 2.94, volume: 8901200 },
  { symbol: "LUCK", price: 1148.0, changePercent: 0.92, changePoints: 10.47, volume: 3120800, isKmi30: true, isKmiAllShare: true },
  { symbol: "ENGRO", price: 318.5, changePercent: -0.41, changePoints: -1.31, volume: 2450900 },
  { symbol: "UBL", price: 372.2, changePercent: 1.47, changePoints: 5.39, volume: 6710300 },
  { symbol: "PSO", price: 384.1, changePercent: -1.18, changePoints: -4.59, volume: 4980100, isKmi30: true, isKmiAllShare: true },
  { symbol: "MEBL", price: 342.8, changePercent: 0.73, changePoints: 2.48, volume: 3345600, isKmi30: true, isKmiAllShare: true },
  { symbol: "FFC", price: 438.25, changePercent: 1.06, changePoints: 4.6, volume: 5220400, isKmi30: true, isKmiAllShare: true },
  { symbol: "SYS", price: 1924.0, changePercent: 2.38, changePoints: 44.72, volume: 1890700, isKmi30: true, isKmiAllShare: true },
  { symbol: "MARI", price: 692.3, changePercent: -0.64, changePoints: -4.46, volume: 990500, isKmi30: true, isKmiAllShare: true },
  { symbol: "TRG", price: 64.85, changePercent: 3.21, changePoints: 2.02, volume: 15602300 },
  { symbol: "POL", price: 598.4, changePercent: 0.35, changePoints: 2.09, volume: 760200, isKmiAllShare: true },
  { symbol: "CNERGY", price: 9.34, changePercent: -0.64, changePoints: -0.06, volume: 50678372, isKmiAllShare: true },
  { symbol: "KEL", price: 8.16, changePercent: 2.77, changePoints: 0.22, volume: 47380226, isKmiAllShare: true },
  { symbol: "BAFL", price: 78.9, changePercent: 1.15, changePoints: 0.9, volume: 3410500 },
  { symbol: "PPL", price: 189.6, changePercent: -0.88, changePoints: -1.68, volume: 7220900, isKmi30: true, isKmiAllShare: true },
];

/**
 * The label the KSE-100 panel shows. The indices feed publishes the
 * bare index name ("KSE-100"); the hero panel has always shown the
 * fuller "KSE-100 Index", so the suffix is applied here rather than
 * changing what the API reports.
 */
const KSE100_PANEL_NAME = "KSE-100 Index";

/**
 * Index level and market status for the KSE-100.
 *
 * Sourced from /api/market/indices rather than a dedicated endpoint.
 * There used to be an api/market/snapshot.ts, but it fetched the exact
 * same PSX timeseries pair (/timeseries/int/KSE100 + /eod/KSE100) and
 * ran the identical previous-close derivation as the indices endpoint's
 * KSE100 entry — it was that endpoint hardcoded to one index, and cost
 * a Vercel function slot to be so. Verified live before removal: both
 * returned value 179846.68, changePercent -0.81, changePoints -1463.6.
 *
 * The panel already fetched BOTH endpoints and then discarded KSE100
 * from the indices response, so this also removes a duplicate request.
 *
 * asOf comes from the KSE100 quote's own tick — not the response-level
 * asOf, which is the freshest tick across all five indices — preserving
 * exactly what the old endpoint reported.
 */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always derive
    // the live KSE-100 snapshot from the indices feed. asOf is stamped
    // fresh per call so the "updated Xs ago" indicator behaves like the
    // live endpoint (which always returns a real asOf) during dev.
    return mockResponse({ ...MARKET_SNAPSHOT, asOf: new Date().toISOString() });
  }

  const indices = await getMarketIndices();
  const kse100 = indices.indices.find((index) => index.code === "KSE100");
  if (!kse100) {
    /*
     * The indices endpoint omits an index it could not fetch rather
     * than fabricating one, so a missing KSE100 is a real outage, not a
     * shape change. Throwing routes it into useAsyncData's error path —
     * the panel renders nothing — which is what the old endpoint's 503
     * did. Never substitute another index for it.
     */
    throw new Error("PSX indices feed carried no KSE-100 entry");
  }

  return {
    index: {
      name: KSE100_PANEL_NAME,
      value: kse100.value,
      changePercent: kse100.changePercent,
      changePoints: kse100.changePoints,
      direction: kse100.direction,
    },
    status: indices.status,
    timestamp: "Karachi · PKT",
    asOf: kse100.asOf,
    source: indices.source,
    stale: indices.stale,
  };
}

/** Live values for the five PSX benchmark indices (multi-index feed). */
export async function getMarketIndices(): Promise<MarketIndicesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as getMarketSnapshot: the serverless route doesn't
    // run under `vite dev`, so serve the fixture. asOf is stamped fresh
    // per call to mirror the live endpoint's real timestamps.
    const asOf = new Date().toISOString();
    return mockResponse({
      indices: MARKET_INDICES.map((index) => ({ ...index, asOf })),
      status: "OPEN",
      asOf,
      source: "psx",
    });
  }
  return apiGet<MarketIndicesResponse>("/api/market/indices");
}

/** The full PSX benchmark-index table (10 indices, derived volume). */
export async function getFullIndices(): Promise<FullIndicesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse({
      indices: FULL_INDICES,
      asOf: new Date().toISOString(),
      source: "psx",
    });
  }
  return apiGet<FullIndicesResponse>("/api/market/indices-full");
}

/**
 * Development fixture for /api/market/global-futures — PMEX index
 * FUTURES (S&P 500 / Nasdaq-100 / Dow Jones / Japan Equity), one
 * standard-size contract per benchmark, values from a real Jul 2026
 * session. Production always serves live PMEX data; these plausible
 * values only exist so the Global Futures tab renders under `vite dev`.
 * High/Low are null (PMEX reports 0 out-of-session) — never fabricated.
 */
const GLOBAL_FUTURES: GlobalFuturesQuote[] = [
  { contract: "SP500-SE26", benchmark: "S&P 500", bid: 7443, ask: 7445.25, open: 7442, previousClose: 7442, changePoints: 1, changePercent: 0.01, direction: "up", volume: 9, high: null, low: null },
  { contract: "NSDQ100-SE26", benchmark: "Nasdaq-100", bid: 28305, ask: 28309, open: 28300.25, previousClose: 28300.25, changePoints: 4.75, changePercent: 0.02, direction: "up", volume: 28, high: null, low: null },
  { contract: "DJ-SE26", benchmark: "Dow Jones", bid: 52086, ask: 52096, open: 52076, previousClose: 52075, changePoints: 11, changePercent: 0.02, direction: "up", volume: 22, high: null, low: null },
  { contract: "JPYEQTY1-SE26", benchmark: "Japan Equity", bid: 64330, ask: 64355, open: 64540, previousClose: 64540, changePoints: -210, changePercent: -0.33, direction: "down", volume: 19, high: null, low: null },
];

/** Live PMEX global index-futures quotes (one standard contract per benchmark). */
export async function getGlobalFutures(): Promise<GlobalFuturesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse({
      futures: GLOBAL_FUTURES,
      asOf: new Date().toISOString(),
      source: "pmex",
    });
  }
  return apiGet<GlobalFuturesResponse>("/api/market/global-futures");
}

/**
 * Development fixture for /api/market/commodities — PMEX commodity
 * FUTURES across Energy, Metals and Agriculture, one standard contract
 * per commodity. Values are from a real Jul 2026 PMEX session (captured
 * live from the endpoint), so the local page reads like production.
 * Aluminum's high/low are null exactly as PMEX reported them for that
 * thinly-traded contract — never back-filled with a fabricated number.
 */
const COMMODITIES: PmexCommodityQuote[] = [
  { contract: "CRUDE1-SE26", commodity: "Crude Oil (WTI)", group: "Energy", bid: 82.2, ask: 82.62, open: 85.92, previousClose: 90.26, changePoints: -7.59, changePercent: -8.35, direction: "down", volume: 7719, high: 86.32, low: 81.86 },
  { contract: "BRENT10-SE26", commodity: "Brent Crude", group: "Energy", bid: 88.09, ask: 88.25, open: 92.95, previousClose: 98.33, changePoints: -9.75, changePercent: -9.89, direction: "down", volume: 1326, high: 93.67, low: 87.53 },
  { contract: "NGAS1K-AU26", commodity: "Natural Gas", group: "Energy", bid: 2.752, ask: 2.757, open: 2.818, previousClose: 2.88, changePoints: -0.12, changePercent: -4.2, direction: "down", volume: 122, high: 2.826, low: 2.74 },
  { contract: "GO1OZ-AU26", commodity: "Gold", group: "Metals", bid: 4077.1, ask: 4077.6, open: 4055.4, previousClose: 4055.3, changePoints: 21.8, changePercent: 0.52, direction: "up", volume: 6073, high: 4118.7, low: 4067.1 },
  { contract: "SL1-SE26", commodity: "Silver", group: "Metals", bid: 58.512, ask: 58.543, open: 58.44, previousClose: 58.417, changePoints: 0.1, changePercent: 0.17, direction: "up", volume: 6185, high: 60.408, low: 58.533 },
  { contract: "COPPER-SE26", commodity: "Copper", group: "Metals", bid: 6.3845, ask: 6.388, open: 6.3465, previousClose: 6.3365, changePoints: 0.05, changePercent: 0.73, direction: "up", volume: 111, high: 6.4065, low: 6.344 },
  { contract: "PLATINUM1-OC26", commodity: "Platinum", group: "Metals", bid: 1626.3, ask: 1628.3, open: 1620.5, previousClose: 1598.9, changePoints: 27.7, changePercent: 1.65, direction: "up", volume: 298, high: 1653.4, low: 1620 },
  { contract: "PALDIUM100-SE26", commodity: "Palladium", group: "Metals", bid: 1288, ask: 1290.5, open: 1271, previousClose: 1244.5, changePoints: 43.5, changePercent: 3.42, direction: "up", volume: 1, high: 1271, low: 1271 },
  { contract: "ALUMINUM1-OC26", commodity: "Aluminum", group: "Metals", bid: 3463, ask: 3478.75, open: 3450.25, previousClose: 3450.25, changePoints: 12.75, changePercent: 0.37, direction: "up", volume: 1, high: null, low: null },
  { contract: "IWHEAT-SE26", commodity: "Wheat", group: "Agriculture", bid: 661.25, ask: 662.5, open: 668.25, previousClose: 675.25, changePoints: -14, changePercent: -2.07, direction: "down", volume: 10, high: 676.5, low: 668.25 },
  { contract: "ICORN-SE26", commodity: "Corn", group: "Agriculture", bid: 450.25, ask: 452, open: 451.25, previousClose: 461.25, changePoints: -11, changePercent: -2.38, direction: "down", volume: 1, high: 452, low: 451.25 },
  { contract: "ISOYBEAN-NO26", commodity: "Soybean", group: "Agriculture", bid: 1212, ask: 1213.25, open: 1216, previousClose: 1252.75, changePoints: -40.75, changePercent: -3.25, direction: "down", volume: 12, high: 1239.75, low: 1216 },
  { contract: "ICOTTON-DE26", commodity: "Cotton", group: "Agriculture", bid: 80.74, ask: 80.89, open: 79.59, previousClose: 80.03, changePoints: 0.71, changePercent: 0.89, direction: "up", volume: 89, high: 81.11, low: 79.59 },
];

/**
 * Live PMEX commodity-FUTURES quotes (one standard contract per
 * commodity, grouped Energy / Metals / Agriculture).
 */
export async function getCommodities(): Promise<PmexCommoditiesResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse({
      commodities: COMMODITIES,
      unavailable: [],
      asOf: new Date().toISOString(),
      source: "pmex",
    });
  }
  return apiGet<PmexCommoditiesResponse>("/api/market/commodities");
}

/**
 * Development fixture for /api/market/etfs — the nine PSX-listed ETFs
 * (sector 0837), values captured from a real Jul 2026 session so the
 * local page reads like production. Production always serves live PSX
 * data; the serverless route doesn't run under `vite dev`.
 */
const ETFS: EtfQuote[] = [
  { symbol: "JSMFETF", name: "JS Momentum Factor Exchange Traded Fund", price: 9.82, ldcp: 9.96, high: 9.99, low: 9.77, changePoints: -0.14, changePercent: -1.41, direction: "down", volume: 1046000 },
  { symbol: "MZNPETF", name: "Meezan Pakistan ETF", price: 17.64, ldcp: 17.76, high: 17.79, low: 17.55, changePoints: -0.12, changePercent: -0.68, direction: "down", volume: 813500 },
  { symbol: "MIIETF", name: "Mahaana Islamic Index ETF", price: 16.51, ldcp: 16.65, high: 16.66, low: 16.45, changePoints: -0.14, changePercent: -0.84, direction: "down", volume: 521500 },
  { symbol: "UBLPETF", name: "UBLPakistan Enterprise ETF", price: 29.5, ldcp: 29.67, high: 29.74, low: 29.21, changePoints: -0.17, changePercent: -0.57, direction: "down", volume: 178500 },
  { symbol: "NBPGETF", name: "NBP Pakistan Growth ETF", price: 26.7, ldcp: 26.95, high: 26.7, low: 26.47, changePoints: -0.25, changePercent: -0.93, direction: "down", volume: 20500 },
  { symbol: "HBLTETF", name: "HBL Total Treasury (ETF)", price: 104.6, ldcp: 104.63, high: 104.65, low: 104.6, changePoints: -0.03, changePercent: -0.03, direction: "down", volume: 15300 },
  { symbol: "JSGBETF", name: "JS Global Banking Sector(ETF)", price: 41.25, ldcp: 41.5, high: 41.5, low: 41.04, changePoints: -0.25, changePercent: -0.6, direction: "down", volume: 9000 },
  { symbol: "ACIETF", name: "Alfalah Consumer Index (ETF)", price: 17.12, ldcp: 17.55, high: 17.35, low: 17.12, changePoints: -0.43, changePercent: -2.45, direction: "down", volume: 5000 },
  { symbol: "NITGETF", name: "NIT Pakistan Gateway ETF", price: 34.27, ldcp: 34.38, high: 34.27, low: 34.27, changePoints: -0.11, changePercent: -0.32, direction: "down", volume: 1000 },
];

/** Live quotes for every PSX-listed ETF (PSX sector code 0837). */
export async function getEtfs(): Promise<EtfsResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse({
      etfs: ETFS,
      asOf: new Date().toISOString(),
      source: "psx",
    });
  }
  return apiGet<EtfsResponse>("/api/market/etfs");
}

/**
 * Development fixture for /api/market/forex — real values and a real
 * source timestamp captured from a live ExchangeRate-API response, so
 * the local page shows a genuine once-daily timestamp rather than a
 * rolling "now" that would misrepresent how this data behaves.
 */
const FOREX_FIXTURE: ForexResponse = {
  rates: [
    { code: "USD", name: "US Dollar", pkrPerUnit: 277.4266 },
    { code: "GBP", name: "British Pound", pkrPerUnit: 372.5697 },
    { code: "EUR", name: "Euro", pkrPerUnit: 319.3381 },
    { code: "AED", name: "UAE Dirham", pkrPerUnit: 75.5416 },
    { code: "SAR", name: "Saudi Riyal", pkrPerUnit: 73.9804 },
    { code: "AUD", name: "Australian Dollar", pkrPerUnit: 194.4125 },
    { code: "CAD", name: "Canadian Dollar", pkrPerUnit: 197.9046 },
    { code: "JPY", name: "Japanese Yen", pkrPerUnit: 1.7277 },
  ],
  gold: {
    basePkrPerTola: 423195,
    lowPkrPerTola: 428273,
    highPkrPerTola: 431236,
    spotUsdPerOz: 4063.1,
    premiumLowPct: 1.2,
    premiumHighPct: 1.9,
    spotAsOf: "2026-08-03",
  },
  sourceUpdatedAt: "Fri, 31 Jul 2026 00:02:31 +0000",
  sourceNextUpdateAt: "Sat, 01 Aug 2026 00:06:21 +0000",
  attribution: "Rates by ExchangeRate-API",
  source: "er-api",
};

/** Mid-market PKR cross rates (not open-market / money changer rates). */
export async function getForex(): Promise<ForexResponse> {
  if (import.meta.env.DEV) {
    // Same dev-gating as the other services: the serverless route
    // doesn't run under `vite dev`, so serve the fixture.
    return mockResponse(FOREX_FIXTURE);
  }
  return apiGet<ForexResponse>("/api/market/forex");
}

/**
 * Development fixture for /api/market/index-constituents — a handful of
 * real large-cap names so the drill-down sub-table renders under `vite
 * dev`. Production serves each index's true constituents from PSX.
 */
const CONSTITUENTS_FIXTURE: IndexConstituent[] = [
  { symbol: "OGDC", name: "Oil & Gas Development Company Limited", ldcp: 315.83, current: 314.5, change: -1.33, changePercent: -0.42, indexWeight: 6.12, indexPoints: -8.4, volume: 922098, freeFloat: 1075000000, marketCap: 1352000000000 },
  { symbol: "MARI", name: "Mari Energies Limited", ldcp: 650.27, current: 650, change: -0.27, changePercent: -0.04, indexWeight: 5.41, indexPoints: -0.5, volume: 229628, freeFloat: 240000000, marketCap: 156000000000 },
  { symbol: "HBL", name: "Habib Bank Limited", ldcp: 142.75, current: 145.1, change: 2.35, changePercent: 1.65, indexWeight: 4.87, indexPoints: 6.2, volume: 8901200, freeFloat: 900000000, marketCap: 213000000000 },
  { symbol: "LUCK", name: "Lucky Cement Limited", ldcp: 1148, current: 1160.5, change: 12.5, changePercent: 1.09, indexWeight: 4.12, indexPoints: 5.1, volume: 3120800, freeFloat: 190000000, marketCap: 341000000000 },
  { symbol: "FFC", name: "Fauji Fertilizer Company Limited", ldcp: 550.2, current: 548.83, change: -1.37, changePercent: -0.25, indexWeight: 3.9, indexPoints: -1.2, volume: 208087, freeFloat: 640000000, marketCap: 697000000000 },
  { symbol: "ENGRO", name: "Engro Holdings Limited", ldcp: 318.5, current: 316.4, change: -2.1, changePercent: -0.66, indexWeight: 3.44, indexPoints: -1.8, volume: 2450900, freeFloat: 340000000, marketCap: 182000000000 },
];

/** On-demand constituents of one index (drill-down). */
export async function getIndexConstituents(
  code: string,
): Promise<IndexConstituentsResponse> {
  if (import.meta.env.DEV) {
    // The serverless route doesn't run under `vite dev`; serve the
    // fixture so the drill-down renders locally.
    return mockResponse({
      code,
      count: CONSTITUENTS_FIXTURE.length,
      constituents: CONSTITUENTS_FIXTURE,
      asOf: new Date().toISOString(),
      source: "psx",
    });
  }
  return apiGet<IndexConstituentsResponse>(
    `/api/market/index-constituents?code=${encodeURIComponent(code)}`,
  );
}

/**
 * The ticker marquee was designed around a ~12-symbol track; passing
 * all ~490 listed symbols would multiply the track width ~40x and
 * turn the fixed-duration CSS loop into a blur. Keep the designed
 * visual density by showing the most active symbols by volume.
 */
const TICKER_SYMBOL_COUNT = 12;

/** Quotes for the scrolling ticker tape and watchlists. */
export async function getTickerQuotes(): Promise<StockQuote[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(TICKER_QUOTES);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return [...watch.quotes]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, TICKER_SYMBOL_COUNT);
}

/**
 * Live session stats (volume, breadth) from the market-watch feed.
 * A second call to /api/market/watch alongside getTickerQuotes() —
 * acceptable behind the endpoint's edge cache, matching the tradeoff
 * accepted in M3.
 */
export async function getMarketWatchStats(): Promise<MarketStat[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(WATCH_STATS);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return watch.stats;
}

/**
 * The FULL quotes array (all ~490 symbols) for the Market Watch page —
 * unlike getTickerQuotes' top-12 slice. Hits the same /api/market/watch
 * URL, so the apiClient dedup/TTL layer collapses it with the ticker's
 * and stats' requests within a page load and shares the endpoint's
 * edge cache.
 */
export async function getAllMarketQuotes(): Promise<StockQuote[]> {
  if (import.meta.env.DEV) {
    // Vercel serverless routes don't run under `vite dev`; the fixture
    // keeps local development working. Deployed builds always fetch
    // live market-watch data from the API route.
    return mockResponse(MARKET_WATCH_FULL);
  }
  const watch = await apiGet<MarketWatchResponse>("/api/market/watch");
  return watch.quotes;
}
