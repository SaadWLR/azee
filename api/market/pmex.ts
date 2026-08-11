import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CommodityGroup,
  PmexCommoditiesResponse,
  PmexCommodityQuote,
} from "../../src/types/commodities";
import type {
  GlobalFuturesQuote,
  GlobalFuturesResponse,
} from "../../src/types/global-futures";

/**
 * GET /api/market/pmex?feed=commodities | global-futures
 *
 * Both PMEX feeds behind one Vercel function. They were two functions
 * (api/market/commodities.ts and api/market/global-futures.ts) that hit
 * the SAME upstream endpoint and differed only in which categories they
 * kept, so they cost two of the twelve Hobby-plan function slots to do
 * one fetch's worth of work.
 *
 * The public URLs are UNCHANGED — vercel.json rewrites
 * /api/market/commodities and /api/market/global-futures onto this file
 * with the matching ?feed=. Nothing in src/ or tests/ had to move, and
 * the response bodies are byte-identical to the originals.
 *
 * Source: POST https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject
 * (empty body, no auth/cookies) returns all ~155 PMEX contracts in one
 * call. Reachable from both Vercel Node and Edge (probed live); built on
 * Node to match the other market-data endpoints — the type-only imports
 * above are erased at compile time and carry no runtime relative import,
 * which is why the PMEX helpers here are inlined rather than shared from
 * a module (every endpoint in api/ is self-contained for that reason).
 *
 * Both feeds are FUTURES, never spot — the types and field names say so
 * throughout (see src/types/commodities.ts, src/types/global-futures.ts)
 * so nothing downstream can present them as spot prices or index levels.
 *
 * RUNTIME: Node.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const PMEX_URL = "https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject";

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
 * The one upstream call both feeds share. Each request fetches once,
 * exactly as each original function did — no cross-request memo, so
 * origin load and data freshness are unchanged from before the merge.
 */
async function fetchPmexContracts(agent: string): Promise<PmexContract[]> {
  const response = await fetch(PMEX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `azee-trade-web/1.0 (${agent})`,
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
  return all;
}

/* ── Feed: global index futures ────────────────────────────────── */

/*
 * The benchmark families, keyed by the STANDARD-size contract's base
 * symbol (the part before the "-<expiry>"). PMEX also lists mini/micro
 * (MINISP500, MICROSP500) and multiple (2NSDQ100, JPYEQTY5) variants
 * whose price/change are IDENTICAL to the standard contract — they
 * differ only in contract size/volume — so showing one row per
 * benchmark (the standard contract) is the clean, non-redundant set.
 * "Standard" is read from the real symbol naming (no MINI/MICRO/multiple
 * prefix), not a fabricated "primary" flag. Base-symbol matching is
 * expiry-agnostic, so it survives contract rollover (SE26 → the next).
 */
const BENCHMARKS: { base: string; name: string }[] = [
  { base: "SP500", name: "S&P 500" },
  { base: "NSDQ100", name: "Nasdaq-100" },
  { base: "DJ", name: "Dow Jones" },
  { base: "JPYEQTY1", name: "Japan Equity" },
];

async function fetchGlobalFutures(): Promise<GlobalFuturesResponse> {
  const all = await fetchPmexContracts("global futures");
  const indices = all.filter((c) => c.Category === "Indices");
  // Structure sanity: the Indices category should carry its usual set of
  // contracts. A near-empty result means the feed/shape changed.
  if (indices.length < 6) {
    throw new Error(
      `PMEX Indices category has only ${indices.length} contracts — feed may have changed`,
    );
  }

  let freshest = 0;
  const futures: GlobalFuturesQuote[] = [];
  for (const { base, name } of BENCHMARKS) {
    // The standard contract for this benchmark, across any expiry, that
    // is actually active (non-zero bid — skips expired contracts, which
    // PMEX zeroes out). If several expiries are live, take the most
    // traded (the front month).
    const matches = indices
      .filter((c) => c.Contract.split("-")[0] === base && num(c.Bid) > 0)
      .sort((a, b) => num(b.Total_Vol) - num(a.Total_Vol));
    const c = matches[0];
    if (!c) continue;

    const changePoints = num(c.Change);
    futures.push({
      contract: c.Contract,
      benchmark: name,
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

  // Sanity floor: every benchmark family must resolve, or fall through
  // to lastGood rather than serve a partial set.
  if (futures.length < BENCHMARKS.length) {
    const found = futures.map((f) => f.benchmark).join(", ");
    throw new Error(
      `PMEX yielded only ${futures.length}/${BENCHMARKS.length} benchmark futures (${found})`,
    );
  }

  return {
    futures,
    asOf: new Date((freshest || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    source: "pmex",
  };
}

/* ── Feed: commodity futures ───────────────────────────────────── */

/*
 * OUT OF SCOPE, deliberately: the Cots category (FX crosses, not
 * commodities), Financials (KIBOR rate futures, verified all-inactive),
 * and Phy_Gold / Phy_Agri (physical PKR-denominated deliverables — a
 * different product type that would need its own distinct framing).
 */

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

/**
 * The live contract for one commodity: the first candidate size that has
 * an actually-active contract (non-zero bid — PMEX zeroes expired and
 * not-yet-trading expiries), taking the most-traded expiry when several
 * are live, which is the front month. Same shape of selection as the
 * global index futures feed above. Expiry-suffixed "…ID" symbols are
 * PMEX's separate intraday product and are excluded so one commodity
 * maps to one standard contract.
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
  const all = await fetchPmexContracts("commodities");
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

/*
 * One lastGood PER FEED, exactly as the two originals each had their
 * own. Sharing a single slot would let one feed's outage serve the
 * other feed's shape. Both survive warm invocations and are the
 * graceful answer when PMEX is down.
 */
let lastGoodCommodities: PmexCommoditiesResponse | null = null;
let lastGoodFutures: GlobalFuturesResponse | null = null;

/**
 * Cache TTL is derived from the data's own freshness rather than a
 * hardcoded session calendar, because these PMEX contracts follow
 * international hours, not the PKT session the PSX endpoints use — and
 * not even one shared set of them (crude and the metals tick
 * continuously while the Agri contracts sit ~15 minutes behind). During
 * a live session PMEX ticks every few seconds, so a 60s edge window
 * keeps values within a minute of live while capping origin to ~1
 * fetch/min. Once everything has gone quiet (weekend/holiday snapshot,
 * _datetime hours old), a 30-minute window makes polls near-free edge
 * hits. Identical to the thresholds both original functions used.
 */
function cacheControl(asOf: string): string {
  const ageSec = Date.now() / 1000 - Date.parse(asOf) / 1000;
  return ageSec <= 5 * 60
    ? "s-maxage=60, stale-while-revalidate=300"
    : "s-maxage=1800, stale-while-revalidate=86400";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const feed = String(req.query.feed ?? "commodities");

  if (feed !== "commodities" && feed !== "global-futures") {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({
      error: `Unknown PMEX feed "${feed}" — expected "commodities" or "global-futures"`,
    });
    return;
  }

  try {
    const data =
      feed === "commodities"
        ? await fetchCommodities()
        : await fetchGlobalFutures();
    if (feed === "commodities") {
      lastGoodCommodities = data as PmexCommoditiesResponse;
    } else {
      lastGoodFutures = data as GlobalFuturesResponse;
    }
    res.setHeader("Cache-Control", cacheControl(data.asOf));
    res.status(200).json(data);
  } catch (error) {
    console.error(`PMEX ${feed} fetch failed:`, error);
    const lastGood =
      feed === "commodities" ? lastGoodCommodities : lastGoodFutures;
    if (lastGood) {
      // Serve the last verified quotes, clearly labelled — never
      // fabricate market data.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error:
        feed === "commodities"
          ? "PMEX commodity futures data is temporarily unavailable"
          : "PMEX global index futures data is temporarily unavailable",
    });
  }
}
