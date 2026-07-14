import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  MarketStat,
  MarketWatchResponse,
  StockQuote,
} from "../../src/types";

/**
 * GET /api/market/watch
 *
 * Live PSX Market Watch: per-symbol quotes for every listed symbol
 * plus the session-wide stats honestly derivable from that table.
 * The frontend never talks to PSX directly (no CORS on the portal,
 * and the raw payload stays server-side).
 *
 * The PSX adapter is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects (see api/market/snapshot.ts). Type-only
 * imports above are erased at compile time and safe.
 */

/*
 * ── PSX Data Portal adapter (Market Watch) ────────────────────────
 * https://dps.psx.com.pk/market-watch is a server-rendered HTML page
 * (verified Jul 10, 2026): one <tr> per listed symbol, and every
 * numeric cell carries its raw value in a data-order attribute, e.g.
 *
 *   <td data-search="CNERGY" data-order="CNERGY">…</td>
 *   <td>0825</td>                        (sector code — no name)
 *   <td>ALLSHR,KSE100,…</td>             (index membership)
 *   <td … data-order="9.4">9.40</td>     LDCP
 *   <td … data-order="9.41">…</td>       OPEN
 *   <td … data-order="9.65">…</td>       HIGH
 *   <td … data-order="9.18">…</td>       LOW
 *   <td … data-order="9.34">…</td>       CURRENT
 *   <td … data-order="-0.06">…</td>      CHANGE
 *   <td … data-order="-0.638">…</td>     CHANGE (%)
 *   <td … data-order="50678372">…</td>   VOLUME
 *
 * Because the page embeds machine-readable data-order values, a
 * targeted regex extraction is simpler and more robust here than DOM
 * traversal — no HTML-parsing dependency is needed, which also keeps
 * the function small and fast.
 *
 * Honesty notes: the sector column carries numeric codes only (no
 * names) and the table has no traded-value column, so top gaining /
 * losing sector and market value are NOT derivable from this page.
 * Derivable session stats: total volume and market breadth
 * (advancers / decliners / symbols traded). The rest waits for a
 * later milestone — never fabricated here.
 */

const MARKET_WATCH_URL = "https://dps.psx.com.pk/market-watch";

/** Column positions within each row's numeric data-order sequence. */
const COL = { ldcp: 0, current: 4, change: 5, changePercent: 6, volume: 7 };
const NUMERIC_CELLS_PER_ROW = 8;

/**
 * A parse this far below PSX's ~450+ listed symbols means the page
 * structure changed — treat the whole fetch as failed rather than
 * serving a silently broken partial table.
 */
const MIN_VALID_ROWS = 50;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatShares(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B shares`;
  return `${(volume / 1e6).toFixed(1)}M shares`;
}

function parseRow(row: string): StockQuote | null {
  const symbol = /data-search="([A-Z0-9.\-]+)"/.exec(row)?.[1];
  if (!symbol) return null;

  const numbers: number[] = [];
  for (const match of row.matchAll(/data-order="(-?[0-9][0-9.]*)"/g)) {
    numbers.push(Number(match[1]));
  }
  if (numbers.length < NUMERIC_CELLS_PER_ROW) return null;

  const price = numbers[COL.current];
  if (!Number.isFinite(price) || price <= 0) return null;

  /*
   * Consistency check: changePoints and changePercent are parsed
   * independently, so a silently misaligned row disagrees with
   * itself. Observed in the wild with symbol "786", whose numeric
   * ticker also matches the symbol cell's data-order attribute and
   * shifts every column by one (price ended up ≈ changePoints).
   * Since price − changePoints ≈ previous close, the implied percent
   * must agree with the parsed percent; rows that disagree beyond
   * tolerance are excluded like any other malformed row.
   */
  const changePoints = numbers[COL.change];
  const changePercent = numbers[COL.changePercent];
  const previousClose = price - changePoints;
  if (previousClose <= 0) return null;
  const impliedPercent = (changePoints / previousClose) * 100;
  // Both fields come raw from PSX and should agree near-exactly; the
  // tolerance only absorbs float noise (absolute floor for near-zero
  // moves, 3% relative for larger ones). Misaligned rows miss by
  // orders of magnitude.
  const tolerance = Math.max(0.15, Math.abs(changePercent) * 0.03);
  if (Math.abs(impliedPercent - changePercent) > tolerance) return null;

  /*
   * Index-membership cell — the 3rd <td>, a comma-separated list of
   * index codes (e.g. "ALLSHR,KMI30,KMIALLSHR,KSE100,..."). Located by
   * requiring a known index token so the numeric sector-code cell
   * (e.g. "0820") is never mistaken for it. Missing/unmatched cell ⇒
   * membership left false; a parse gap here degrades to "not a listed
   * member", never a fabricated compliance claim. KMI30/KMIALLSHR are
   * PSX's official Shariah indices (screened per KMI methodology).
   */
  const membership =
    /<td>([A-Z0-9,]*(?:ALLSHR|KMIALLSHR|KMI30|KSE100|KSE30)[A-Z0-9,]*)<\/td>/.exec(
      row,
    )?.[1] ?? "";
  const codes = new Set(membership.split(","));

  return {
    symbol,
    price: round2(price),
    changePercent: round2(changePercent),
    changePoints: round2(changePoints),
    volume: Math.round(numbers[COL.volume]),
    isKmi30: codes.has("KMI30"),
    isKmiAllShare: codes.has("KMIALLSHR"),
  };
}

/**
 * Fetches and normalizes the live market-watch table. The raw PSX
 * payload never leaves this function.
 */
async function fetchMarketWatch(): Promise<MarketWatchResponse> {
  const response = await fetch(MARKET_WATCH_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (market watch)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for market-watch`);
  }
  const html = await response.text();

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const quotes: StockQuote[] = [];
  for (const row of rows) {
    const quote = parseRow(row);
    if (quote) quotes.push(quote);
  }
  if (quotes.length < MIN_VALID_ROWS) {
    throw new Error(
      `PSX market-watch parse yielded only ${quotes.length} valid rows — page structure may have changed`,
    );
  }

  const totalVolume = quotes.reduce((sum, q) => sum + (q.volume ?? 0), 0);
  const advancers = quotes.filter((q) => q.changePercent > 0).length;
  const decliners = quotes.filter((q) => q.changePercent < 0).length;

  const stats: MarketStat[] = [
    { label: "Market Volume", value: formatShares(totalVolume) },
    { label: "Advancers", value: String(advancers), direction: "up" },
    { label: "Decliners", value: String(decliners), direction: "down" },
    { label: "Symbols Traded", value: String(quotes.length) },
  ];

  return {
    quotes,
    stats,
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Approximate PSX session window (Mon–Fri, 09:00–16:45 PKT, covering
 * the split Friday sessions) — drives cache duration only. Duplicated
 * rather than shared with snapshot.ts per the no-relative-runtime-
 * imports constraint; snapshot.ts derives OPEN/CLOSED from tick
 * freshness instead, which this HTML page cannot offer.
 */
function isPktSessionWindow(now = new Date()): boolean {
  const pkt = new Date(now.getTime() + PKT_OFFSET_MS);
  const day = pkt.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 16 * 60 + 45;
}

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: MarketWatchResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const watch = await fetchMarketWatch();
    lastGood = watch;
    res.setHeader(
      "Cache-Control",
      isPktSessionWindow()
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(watch);
  } catch (error) {
    console.error("PSX market-watch fetch failed:", error);
    if (lastGood) {
      // Serve the last verified table, clearly labelled — never
      // fabricate market data.
      res.setHeader(
        "Cache-Control",
        "s-maxage=30, stale-while-revalidate=600",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PSX market-watch data is temporarily unavailable",
    });
  }
}

export { fetchMarketWatch };
