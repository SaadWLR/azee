import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CommodityGroup,
  PmexCommoditiesResponse,
  PmexCommodityQuote,
} from "../../src/types/commodities";

/**
 * GET /api/market/commodities
 *
 * Live commodity-FUTURES quotes from PMEX (Pakistan Mercantile Exchange)
 * — one of AZEE's own two member exchanges, and the exchange behind the
 * "PMEX Commodities" offering the Products section advertises. These are
 * PMEX futures contracts on international commodities (crude oil, gold,
 * wheat, …) — NOT spot commodity prices. The response is typed and named
 * as futures throughout so nothing downstream can present them as spot
 * rates (see src/types/commodities.ts).
 *
 * Source: POST https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject
 * (empty body, no auth/cookies) returns all 155 PMEX contracts in one
 * call; we keep the four international commodity categories below. Same
 * endpoint the global-futures route uses. Reachable from both Vercel
 * Node and Edge (probed live); built on Node to match the other
 * market-data endpoints — the type-only import above is erased at
 * compile time and carries no runtime relative import, which is why the
 * small PMEX helpers here are inlined rather than shared from a module
 * (every endpoint in api/ is self-contained for exactly this reason).
 *
 * OUT OF SCOPE, deliberately: the Cots category (FX crosses, not
 * commodities), Financials (KIBOR rate futures, verified all-inactive),
 * and Phy_Gold / Phy_Agri (physical PKR-denominated deliverables — a
 * different product type that would need its own distinct framing).
 *
 * RUNTIME: Node.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const PMEX_URL = "https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject";

/** The PMEX categories carrying international commodity futures. */
const COMMODITY_CATEGORIES = ["Energy", "Oil", "Metals", "Agri"];

interface CommoditySpec {
  name: string;
  group: CommodityGroup;
  /** The PMEX category the contract lives in. */
  category: string;
  /**
   * Candidate base symbols (the part before "-<expiry>"), in preference
   * order. PMEX lists the SAME commodity in several contract sizes
   * (CRUDE1 / CRUDE10 / CRUDE100 / CRUDE1000; GO1OZ / GO10OZ / GO100OZ)
   * whose bid/ask/change are IDENTICAL — they differ only in contract
   * size and therefore volume. Listing them in order lets us show one
   * row per commodity using the size PMEX's market actually trades,
   * while still resolving if that size is dormant for a session. Base
   * matching is expiry-agnostic by construction.
   */
  bases: string[];
}

/*
 * The v1 set: recognizable, actively-traded international commodities,
 * confirmed live against the feed. No expiry is ever named here —
 * expiries roll over (CRUDE1-SE26 → CRUDE1-NO26 …) and PMEX zeroes out
 * the ones that are not trading, so the live contract is discovered at
 * request time by the selection below.
 */
const COMMODITIES: CommoditySpec[] = [
  // Energy
  {
    name: "Crude Oil (WTI)",
    group: "Energy",
    category: "Oil",
    bases: ["CRUDE1", "CRUDE10", "CRUDE100", "CRUDE1000"],
  },
  {
    name: "Brent Crude",
    group: "Energy",
    category: "Oil",
    bases: ["BRENT10", "BRENT100", "BRENT1000"],
  },
  {
    name: "Natural Gas",
    group: "Energy",
    category: "Energy",
    bases: ["NGAS1K", "NGAS10K"],
  },
  // Metals
  {
    name: "Gold",
    group: "Metals",
    category: "Metals",
    bases: ["GO1OZ", "GO10OZ", "GO100OZ", "GOMOZ"],
  },
  {
    name: "Silver",
    group: "Metals",
    category: "Metals",
    bases: ["SL1", "SL10", "SL100OZ", "SL500OZ", "SL5000OZ"],
  },
  {
    name: "Copper",
    group: "Metals",
    category: "Metals",
    bases: ["COPPER", "COPPER100", "COPPER25K"],
  },
  {
    name: "Platinum",
    group: "Metals",
    category: "Metals",
    bases: ["PLATINUM1", "PLATINUMHOZ", "PLATINUM5", "PLATINUM50"],
  },
  {
    name: "Palladium",
    group: "Metals",
    category: "Metals",
    bases: ["PALDIUM100"],
  },
  {
    name: "Aluminum",
    group: "Metals",
    category: "Metals",
    bases: ["ALUMINUM1", "ALUMINUM5"],
  },
  // Agriculture
  { name: "Wheat", group: "Agriculture", category: "Agri", bases: ["IWHEAT"] },
  { name: "Corn", group: "Agriculture", category: "Agri", bases: ["ICORN"] },
  {
    name: "Soybean",
    group: "Agriculture",
    category: "Agri",
    bases: ["ISOYBEAN"],
  },
  {
    name: "Cotton",
    group: "Agriculture",
    category: "Agri",
    bases: ["ICOTTON", "ICOTTON50K"],
  },
];

/**
 * Below this, treat the feed as broken rather than serve a thin table:
 * a real session resolves all 13 (verified live), and individual
 * dormant commodities are reported via `unavailable` instead. Set well
 * under 13 so one quiet contract can never blank the endpoint.
 */
const MIN_COMMODITIES = 8;

interface PmexContract {
  Contract: string;
  Bid: number | string;
  Ask: number | string;
  Open: number | string;
  Close: number | string;
  High: number | string;
  Low: number | string;
  Change: number | string;
  Change_Per: number | string;
  Total_Vol: number | string | null;
  Category: string;
  _datetime: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** High/Low are 0 when PMEX has not reported a session range; map that
 *  to null rather than a fabricated 0. */
function nullableLevel(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "CRUDE1-SE26" → ["CRUDE1", "SE26"]. */
function splitContract(contract: string): [string, string] {
  const [base, expiry = ""] = String(contract).split("-");
  return [base, expiry];
}

/**
 * The live contract for one commodity: the first candidate size that has
 * an actually-active contract (non-zero bid — PMEX zeroes expired and
 * not-yet-trading expiries), taking the most-traded expiry when several
 * are live, which is the front month. Same shape of selection as the
 * global index futures route. Expiry-suffixed "…ID" symbols are PMEX's
 * separate intraday product and are excluded so one commodity maps to
 * one standard contract.
 */
function selectContract(
  pool: PmexContract[],
  spec: CommoditySpec,
): PmexContract | null {
  for (const base of spec.bases) {
    const live = pool
      .filter((c) => {
        const [b, expiry] = splitContract(c.Contract);
        return b === base && !expiry.endsWith("ID") && num(c.Bid) > 0;
      })
      .sort((a, b) => num(b.Total_Vol) - num(a.Total_Vol));
    if (live[0]) return live[0];
  }
  return null;
}

async function fetchCommodities(): Promise<PmexCommoditiesResponse> {
  const response = await fetch(PMEX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "azee-trade-web/1.0 (commodities)",
    },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`PMEX responded ${response.status} for market watch`);
  }
  const all = (await response.json()) as PmexContract[];
  if (!Array.isArray(all)) {
    throw new Error("PMEX returned a non-array payload");
  }
  const pool = all.filter((c) => COMMODITY_CATEGORIES.includes(c.Category));
  // Structure sanity: these four categories carry ~60 contracts. A
  // near-empty result means the feed or its category names changed.
  if (pool.length < 20) {
    throw new Error(
      `PMEX commodity categories hold only ${pool.length} contracts — feed may have changed`,
    );
  }

  let freshest = 0;
  const commodities: PmexCommodityQuote[] = [];
  const unavailable: string[] = [];

  for (const spec of COMMODITIES) {
    const c = selectContract(
      pool.filter((x) => x.Category === spec.category),
      spec,
    );
    if (!c) {
      // Genuinely not quoted right now — reported as such, never
      // zero-filled.
      unavailable.push(spec.name);
      continue;
    }

    const changePoints = num(c.Change);
    commodities.push({
      contract: c.Contract,
      commodity: spec.name,
      group: spec.group,
      bid: num(c.Bid),
      ask: num(c.Ask),
      open: num(c.Open),
      previousClose: num(c.Close),
      changePoints: round2(changePoints),
      changePercent: round2(num(c.Change_Per)),
      direction: changePoints >= 0 ? "up" : "down",
      volume: Math.round(num(c.Total_Vol)),
      high: nullableLevel(c.High),
      low: nullableLevel(c.Low),
    });
    if (typeof c._datetime === "number" && c._datetime > freshest) {
      freshest = c._datetime;
    }
  }

  if (commodities.length < MIN_COMMODITIES) {
    throw new Error(
      `PMEX yielded only ${commodities.length}/${COMMODITIES.length} commodity futures — falling back rather than serving a thin table`,
    );
  }

  return {
    commodities,
    unavailable,
    asOf: new Date(
      (freshest || Math.floor(Date.now() / 1000)) * 1000,
    ).toISOString(),
    source: "pmex",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when PMEX is down. */
let lastGood: PmexCommoditiesResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const data = await fetchCommodities();
    lastGood = data;
    /*
     * Cache TTL is derived from the data's own freshness rather than a
     * hardcoded session calendar — same reasoning as the global futures
     * route, and it matters more here: these contracts track
     * international commodity hours (and not even one shared set of
     * them — crude and the metals tick continuously while the Agri
     * contracts sit ~15 minutes behind), so no PKT session window
     * describes them. Freshness is read off the freshest contract in
     * the set. During a live session PMEX ticks these every few
     * seconds, so a 60s edge window keeps values within a minute of
     * live while capping origin to ~1 fetch/min; once everything has
     * gone quiet (weekend/holiday snapshot, _datetime hours old), a
     * 30-minute window makes polls near-free edge hits.
     */
    const ageSec = Date.now() / 1000 - Date.parse(data.asOf) / 1000;
    const live = ageSec <= 5 * 60;
    res.setHeader(
      "Cache-Control",
      live
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("PMEX commodities fetch failed:", error);
    if (lastGood) {
      // Serve the last verified quotes, clearly labelled — never
      // fabricate market data.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PMEX commodity futures data is temporarily unavailable",
    });
  }
}
