import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  FullIndexQuote,
  FullIndicesResponse,
} from "../../src/types/indices-full";

/**
 * GET /api/market/indices-full
 *
 * The full PSX benchmark-index table: the 10 headline indices with
 * High/Low/Current/Change/%Change, plus a DERIVED per-index volume.
 * The frontend never talks to PSX directly (no CORS, and the raw HTML
 * stays server-side).
 *
 * RUNTIME: Node only. Probed live from Vercel (Jul 2026):
 * GET dps.psx.com.pk/indices returns 200 real HTML from the Node
 * runtime but HTTP 462 (a WAF bot-block page) from the Edge runtime —
 * the same Node-only reachability as the PSX calendar/payouts routes,
 * and the reverse of Business Recorder (Edge-only). Do NOT move this to
 * Edge. The PSX adapter is inlined (no relative runtime imports between
 * api/ functions) for the same reason as snapshot.ts/watch.ts.
 *
 * SOURCES (both server-rendered HTML with machine-readable data-order
 * attributes, so targeted regex extraction is simpler and more robust
 * than DOM parsing — no new dependency):
 *  - dps.psx.com.pk/indices     bulk table: one <tr data-code> per index
 *                               with High, Low, Current, Change, %Change.
 *  - dps.psx.com.pk/market-watch per-symbol rows carrying volume and an
 *                               index-membership cell; volume is summed
 *                               by membership to derive a per-index total.
 *
 * NO value/turnover field: PSX's public portal exposes no traded-value
 * metric for an index anywhere (verified across /indices, the per-index
 * pages, and market-watch), so it is omitted entirely rather than
 * carried as a misleading null — see src/types/indices-full.ts.
 */

const INDICES_URL = "https://dps.psx.com.pk/indices";
const MARKET_WATCH_URL = "https://dps.psx.com.pk/market-watch";

/*
 * The 10 target indices in display order (broad-market first, then the
 * sector/tradable indices), with their official names. Names verified
 * against this session's research; UPP9 → "UBL Pakistan Enterprise
 * Index" is the label carried from the reference set (the UPP9 code
 * does not map obviously to that name, so it is the one flagged as
 * least-certain in the report — all others are standard PSX names).
 */
const TARGETS: { code: string; name: string }[] = [
  { code: "KSE100", name: "KSE-100 Index" },
  { code: "KSE30", name: "KSE-30 Index" },
  { code: "ALLSHR", name: "KSE All Share Index" },
  { code: "KMI30", name: "KMI-30 Index" },
  { code: "KMIALLSHR", name: "KMI All Share Index" },
  { code: "PSXDIV20", name: "PSX Dividend 20 Index" },
  { code: "BKTI", name: "Banking Tradable Index" },
  { code: "OGTI", name: "Oil & Gas Tradable Index" },
  { code: "UPP9", name: "UBL Pakistan Enterprise Index" },
  { code: "NITPGI", name: "NIT Pakistan Gateway Index" },
];
const TARGET_CODES = new Set(TARGETS.map((t) => t.code));

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface IndexRow {
  high: number;
  low: number;
  current: number;
  change: number;
  changePercent: number;
}

/**
 * Parses the /indices bulk listing. Each index row is anchored by a
 * data-code attribute and carries exactly five data-order numbers, in
 * order: High, Low, Current, Change, %Change. The default-loaded KSE100
 * constituents table on the same page uses `tbl__symbol` anchors (no
 * data-code), so this filter never mixes the two.
 */
function parseIndicesTable(html: string): Map<string, IndexRow> {
  const out = new Map<string, IndexRow>();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const code = /data-code="([A-Z0-9]+)"/.exec(row)?.[1];
    if (!code || !TARGET_CODES.has(code)) continue;
    const nums = [...row.matchAll(/data-order="(-?[0-9][0-9.]*)"/g)].map((m) =>
      Number(m[1]),
    );
    if (nums.length < 5) continue;
    const [high, low, current, change, changePercent] = nums;
    if (!Number.isFinite(current) || current <= 0) continue;
    out.set(code, { high, low, current, change, changePercent });
  }
  return out;
}

/** Numeric cell layout of a market-watch row (see watch.ts). */
const COL_VOLUME = 7;
const NUMERIC_CELLS_PER_ROW = 8;

/*
 * Membership cell — a comma-separated list of the index codes a symbol
 * belongs to. Located by requiring a known index token so the numeric
 * sector-code cell is never mistaken for it (same technique as
 * watch.ts, widened to the sector/tradable codes so their members are
 * caught too).
 */
const MEMBERSHIP_RE =
  /<td>([A-Z0-9,]*(?:ALLSHR|KMIALLSHR|KMI30|KSE100|KSE30|PSXDIV20|BKTI|OGTI|UPP9|NITPGI)[A-Z0-9,]*)<\/td>/;

/**
 * Derives per-index volume by summing the volume of every market-watch
 * symbol whose membership cell contains that index's code.
 *
 * KNOWN LIMITATION (documented, not hidden): market-watch lists only
 * actively-traded ready-board symbols (~485 rows), while the two
 * all-share indices have more official constituents (ALLSHR 554,
 * KMIALLSHR 311). So their derived volume is a slight UNDERCOUNT —
 * every share it counts is real, but a handful of untraded members are
 * absent. Every other index (KSE-100/30, KMI-30, PSXDIV20, and the four
 * sector/tradable indices) is fully covered and exact.
 */
function volumeByIndex(marketWatchHtml: string): Record<string, number> {
  const vol: Record<string, number> = {};
  const rows = marketWatchHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    if (!/data-search="[A-Z0-9.\-]+"/.test(row)) continue;
    const nums = [...row.matchAll(/data-order="(-?[0-9][0-9.]*)"/g)].map((m) =>
      Number(m[1]),
    );
    if (nums.length < NUMERIC_CELLS_PER_ROW) continue;
    const volume = Math.round(nums[COL_VOLUME]);
    if (!Number.isFinite(volume) || volume < 0) continue;
    const membership = MEMBERSHIP_RE.exec(row)?.[1] ?? "";
    for (const code of membership.split(",")) {
      if (TARGET_CODES.has(code)) vol[code] = (vol[code] ?? 0) + volume;
    }
  }
  return vol;
}

async function fetchHtml(url: string, label: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (indices full)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for ${label}`);
  }
  return response.text();
}

/**
 * Fetches and normalizes the full index table. Both upstreams are
 * required: the index levels come from /indices and the derived volume
 * from /market-watch, so a failure of either falls through to
 * lastGood/503 rather than serving a half-populated table.
 */
async function fetchFullIndices(): Promise<FullIndicesResponse> {
  const [indicesHtml, watchHtml] = await Promise.all([
    fetchHtml(INDICES_URL, "indices"),
    fetchHtml(MARKET_WATCH_URL, "market-watch"),
  ]);

  const table = parseIndicesTable(indicesHtml);
  // Sanity floor: every one of the 10 target codes must be present, or
  // the page structure has changed — fail rather than serve a partial
  // list (mirrors MIN_VALID_ROWS in watch.ts / MIN_ITEMS in news).
  const missing = TARGETS.filter((t) => !table.has(t.code)).map((t) => t.code);
  if (missing.length > 0) {
    throw new Error(
      `PSX /indices missing target codes (${missing.join(", ")}) — page structure may have changed`,
    );
  }

  const vol = volumeByIndex(watchHtml);

  const indices: FullIndexQuote[] = TARGETS.map(({ code, name }) => {
    const row = table.get(code)!;
    return {
      code,
      name,
      value: round2(row.current),
      high: round2(row.high),
      low: round2(row.low),
      changePoints: round2(row.change),
      changePercent: round2(row.changePercent),
      direction: row.change >= 0 ? "up" : "down",
      volume: vol[code] ?? 0,
    };
  });

  return { indices, asOf: new Date().toISOString(), source: "psx" };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Approximate PSX session window (Mon–Fri, 09:00–16:45 PKT) — drives
 * cache duration only. Duplicated rather than shared per the
 * no-relative-runtime-imports constraint.
 */
function isPktSessionWindow(now = new Date()): boolean {
  const pkt = new Date(now.getTime() + PKT_OFFSET_MS);
  const day = pkt.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 16 * 60 + 45;
}

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: FullIndicesResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const data = await fetchFullIndices();
    lastGood = data;
    /*
     * In-session: s-maxage=60. The /indices levels move at PSX's ~15s
     * tick resolution, but a display panel doesn't need sub-minute
     * freshness, and each miss costs TWO PSX fetches (/indices +
     * /market-watch, ~530 KB combined). A 60s edge window caps that to
     * one origin revalidation per minute globally while keeping values
     * within a minute of live — the same balance watch.ts strikes for
     * the same data class and the same dual-scrape cost. Out of
     * session the values are the static last close, so a 30-minute
     * window makes those polls near-free edge hits.
     */
    res.setHeader(
      "Cache-Control",
      isPktSessionWindow()
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("PSX indices-full fetch failed:", error);
    if (lastGood) {
      // Serve the last verified table, clearly labelled — never
      // fabricate market data.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PSX index data is temporarily unavailable",
    });
  }
}
