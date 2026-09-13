import { ApiError, apiGet, mockResponse } from "../lib/apiClient";
import type {
  EconomicDashboardPending,
  EconomicDashboardReady,
  EconomicDashboardResponse,
} from "../types/economic-dashboard";

/*
 * Pakistan's headline macro indicators come from /api/economic/dashboard,
 * which serves the snapshot a daily cron reads from SBP EasyData. Under
 * `vite dev` the serverless route doesn't run, so the DEV fixtures below
 * keep local development working.
 *
 * READY_FIXTURE is the real snapshot, copied verbatim from the live
 * endpoint (captured Sep 13 2026) — every figure, period and series key
 * is what SBP published. As with the calendar fixtures, do not edit a
 * figure: a plausible-looking macro number is a fabricated fact even in
 * a dev-only file.
 *
 * Production is past "pending" and almost always fully fresh, so the
 * page's other states would never be seen locally without a way to ask
 * for them. Append ?fixture= to the page URL under `vite dev`:
 *
 *   (none)             the real snapshot, all nine indicators fresh
 *   ?fixture=degraded  the same snapshot with CPI stale and quarterly GDP
 *                      unavailable — the per-indicator fallbacks
 *   ?fixture=pending   before the first daily run has ever written
 *   ?fixture=error     the endpoint answering 503
 *
 * The degraded variant changes only statuses and timestamps, never a
 * figure: CPI keeps its real reading, carried forward exactly as the API
 * carries a stale one forward.
 */
const READY_FIXTURE: EconomicDashboardReady = {
  status: "ready",
  source: "sbp-easydata",
  updatedAt: "2026-09-13T18:59:23.689Z",
  indicators: {
    policyRate: {
      status: "fresh",
      periodLabel: "28-Apr-2026",
      asOf: "2026-04-28",
      frequency: "as-needed",
      values: { ratePercent: 11.5, lastChangeDate: "2026-04-28" },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:220:0::NO:RP:P220_SERIES_KEY,P220_PAGE_ID:TS_GP_IR_SIRPR_AH.SBPOL0030,1&cs=13D7590643363136B3450AEAF0AD26B0F",
        seriesKeys: ["TS_GP_IR_SIRPR_AH.SBPOL0030"],
      },
      fetchedAt: "2026-09-13T18:59:26.621Z",
    },
    cpi: {
      status: "fresh",
      periodLabel: "Aug-2026",
      asOf: "2026-08-31",
      frequency: "monthly",
      values: {
        headline: { yoyPercent: 11.1, momPercent: 1.2 },
        core: {
          measure: "NFNE",
          urban: { yoyPercent: 8.8, momPercent: 0.5 },
          rural: { yoyPercent: 8.5, momPercent: 0.6 },
        },
      },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_PT_CPI_M,250&cs=1FE05C0C45F0634A6B6B0D713DEABA7B5",
        seriesKeys: [
          "TS_GP_PT_CPI_M.P00011516",
          "TS_GP_PT_CPI_M.P00461516",
          "TS_GP_PT_CPI_M.P00121516",
          "TS_GP_PT_CPI_M.P00571516",
          "TS_GP_PT_CPI_M.P00131516",
          "TS_GP_PT_CPI_M.P00581516",
        ],
      },
      fetchedAt: "2026-09-13T18:59:26.015Z",
    },
    gdpAnnual: {
      status: "fresh",
      periodLabel: "2026",
      asOf: "2026-06-30",
      frequency: "fiscal-year",
      values: { growthPercent: 3.7 },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_RLS_PAKGDP15_Y,250&cs=1C074C539DEE45561A1B7BB7AF1984925",
        seriesKeys: ["TS_GP_RLS_PAKGDP15_Y.GDP00160000"],
      },
      fetchedAt: "2026-09-13T18:59:26.428Z",
    },
    gdpQuarterly: {
      status: "fresh",
      periodLabel: "Mar-2026",
      asOf: "2026-03-31",
      frequency: "quarterly",
      values: { growthPercent: 3.99 },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_RS_QGDP1516_Q,250&cs=174F22DDAD6A4907C011565ADD73166D5",
        seriesKeys: ["TS_GP_RS_QGDP1516_Q.QGDP00080000"],
      },
      fetchedAt: "2026-09-13T18:59:25.521Z",
    },
    fxReserves: {
      status: "fresh",
      periodLabel: "Jul-2026",
      asOf: "2026-07-31",
      frequency: "monthly",
      values: {
        sbpNetMillionUsd: 17043.1,
        banksNetMillionUsd: 4845.63,
        total: {
          millionUsd: 21888.73,
          computed: true,
          formula:
            "Net reserves with SBP + net reserves with banks — SBP's own definition of total liquid FX reserves (row 19 = 2 + 10), whose published series (TS_GP_EXT_PAKRES_M.Z00060) is empty on EasyData",
        },
      },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_EXT_PAKRES_M,250&cs=110234795008534EEC3F4AF864E4AA0FA",
        seriesKeys: ["TS_GP_EXT_PAKRES_M.Z00030", "TS_GP_EXT_PAKRES_M.Z00050"],
      },
      fetchedAt: "2026-09-13T18:59:26.856Z",
    },
    externalDebt: {
      status: "fresh",
      periodLabel: "Jun-2026",
      asOf: "2026-06-30",
      frequency: "quarterly",
      values: { totalMillionUsd: 138849.81 },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_ED_PKEDLOUT_Q,250&cs=13E426B9670422967C60205D728B67D49",
        seriesKeys: ["TS_GP_ED_PKEDLOUT_Q.STO00570"],
      },
      fetchedAt: "2026-09-13T18:59:26.066Z",
    },
    debtServicing: {
      status: "fresh",
      periodLabel: "Jun-2026",
      asOf: "2026-06-30",
      frequency: "quarterly",
      values: {
        longTermPrincipalMillionUsd: 8591.53,
        shortTermPrincipalMillionUsd: 215.81,
        interestMillionUsd: 1329.32,
      },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_ED_PKEDLSER_Q,250&cs=1B397C80D4E713EBFADF8D5B57CB707CA",
        seriesKeys: [
          "TS_GP_ED_PKEDLSER_Q.DS00300",
          "TS_GP_ED_PKEDLSER_Q.DS00310",
          "TS_GP_ED_PKEDLSER_Q.DS00860",
        ],
      },
      fetchedAt: "2026-09-13T18:59:26.440Z",
    },
    trade: {
      status: "fresh",
      periodLabel: "Jul-2026",
      asOf: "2026-07-31",
      frequency: "monthly",
      values: {
        exportsMillionUsd: 3008,
        importsMillionUsd: 6154,
        balanceMillionUsd: -3146,
        basis: "balance-of-payments-goods",
      },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:211:0::NO:RP:P211_DATASET_TYPE_CODE,P211_PAGE_ID:TS_GP_BOP_BPM6SUM_M,250&cs=195EC35589875E64981F7BAF0BAFDC5C2",
        seriesKeys: [
          "TS_GP_BOP_BPM6SUM_M.P00030",
          "TS_GP_BOP_BPM6SUM_M.P00040",
          "TS_GP_BOP_BPM6SUM_M.P00050",
        ],
      },
      fetchedAt: "2026-09-13T18:59:25.617Z",
    },
    remittances: {
      status: "fresh",
      periodLabel: "Aug-2026",
      asOf: "2026-08-31",
      frequency: "monthly",
      values: { inflowMillionUsd: 3656.33767 },
      source: {
        url: "https://easydata.sbp.org.pk/apex/f?p=10:220:0::NO:RP:P220_SERIES_KEY,P220_PAGE_ID:TS_GP_BOP_WR_M.WR0340,1&cs=1B95E07DAC54300CB4A05B1C40048156D",
        seriesKeys: ["TS_GP_BOP_WR_M.WR0340"],
      },
      fetchedAt: "2026-09-13T18:59:25.592Z",
    },
  },
};

/*
 * The real snapshot with two indicators failing, shaped exactly as the
 * API shapes them: CPI carried forward as stale (its reading untouched,
 * its fetchedAt older than the failure streak), quarterly GDP never read.
 */
const DEGRADED_FIXTURE: EconomicDashboardReady = {
  ...READY_FIXTURE,
  indicators: {
    ...READY_FIXTURE.indicators,
    cpi: {
      ...READY_FIXTURE.indicators.cpi,
      status: "stale",
      fetchedAt: "2026-09-11T14:04:12.310Z",
      staleSince: "2026-09-12T14:03:58.102Z",
      lastAttemptAt: "2026-09-13T18:59:23.689Z",
      lastError: "SBP responded 503",
    } as EconomicDashboardReady["indicators"]["cpi"],
    gdpQuarterly: {
      status: "unavailable",
      lastAttemptAt: "2026-09-13T18:59:23.689Z",
      lastError: "EasyData rejected the page checksum (session state protection)",
    },
  },
};

/** The endpoint's own pending body, verbatim. */
const PENDING_FIXTURE: EconomicDashboardPending = {
  status: "pending",
  message:
    "Economic indicators have not been fetched yet. They are collected from SBP EasyData once a day and will appear after the first daily update.",
};

/** Pakistan's headline macro indicators, as last collected from SBP EasyData. */
export async function getEconomicDashboard(): Promise<EconomicDashboardResponse> {
  if (import.meta.env.DEV) {
    const variant = new URLSearchParams(window.location.search).get("fixture");
    if (variant === "pending") return mockResponse(PENDING_FIXTURE);
    if (variant === "degraded") return mockResponse(DEGRADED_FIXTURE);
    if (variant === "error") {
      // The same error apiGet raises for a 503, so the page's failure
      // path is exercised exactly as production would reach it.
      throw new ApiError(
        503,
        "GET /api/economic/dashboard failed with status 503",
      );
    }
    return mockResponse(READY_FIXTURE);
  }
  return apiGet<EconomicDashboardResponse>("/api/economic/dashboard");
}
