import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  MarketStat,
  MarketWatchResponse,
  StockQuote,
} from "../../src/types";
import type { EtfQuote, EtfsResponse } from "../../src/types/etfs";

/**
 * GET /api/market/psx-watch?view=watch | etfs
 *
 * Both views of PSX's market-watch table behind one Vercel function.
 * They were two functions (api/market/watch.ts and api/market/etfs.ts)
 * fetching the SAME server-rendered page and differing only in how they
 * shaped it — the full per-symbol table vs the sector-0837 ETF subset —
 * so they cost two of the twelve Hobby function slots for one page.
 *
 * The public URLs are UNCHANGED — vercel.json rewrites
 * /api/market/watch and /api/market/etfs onto this file with the
 * matching ?view=. Nothing in src/ or tests/ moves, and the response
 * bodies are identical to the originals.
 *
 * The two views keep genuinely different parsers: ETF rows are filtered
 * by PSX's own sector code and carry LDCP/high/low plus a stronger
 * cross-check against PSX's published previous close, while the watch
 * view carries index membership and derives session stats. Merging the
 * transport did not merge the parsing.
 *
 * The PSX adapter is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects. Type-only imports above are erased at
 * compile time and safe.
 *
 * RUNTIME: Node — dps.psx.com.pk is Node-reachable and Edge-blocked
 * (HTTP 462 from Edge egress), same as every other PSX endpoint here.
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

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const MARKET_WATCH_URL = "https://dps.psx.com.pk/market-watch";

const NUMERIC_CELLS_PER_ROW = 8;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The numeric data-order values of one row, in column order. */
function rowNumbers(row: string): number[] {
  const numbers: number[] = [];
  for (const match of row.matchAll(/data-order="(-?[0-9][0-9.]*)"/g)) {
    numbers.push(Number(match[1]));
  }
  return numbers;
}

/**
 * The one upstream call both views share. Each request fetches once,
 * exactly as each original function did — no cross-request memo, so
 * origin load and data freshness are unchanged from before the merge.
 */
async function fetchMarketWatchHtml(agent: string): Promise<string> {
  const response = await fetch(MARKET_WATCH_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": `azee-trade-web/1.0 (${agent})`,
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for market-watch`);
  }
  return response.text();
}

/* ── View: full market watch ───────────────────────────────────── */

/** Column positions within each row's numeric data-order sequence. */
const WATCH_COL = {
  ldcp: 0,
  current: 4,
  change: 5,
  changePercent: 6,
  volume: 7,
};

/**
 * A parse this far below PSX's ~450+ listed symbols means the page
 * structure changed — treat the whole fetch as failed rather than
 * serving a silently broken partial table.
 */
const MIN_VALID_ROWS = 50;

function formatShares(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B shares`;
  return `${(volume / 1e6).toFixed(1)}M shares`;
}

function parseRow(row: string): StockQuote | null {
  const symbol = /data-search="([A-Z0-9.\-]+)"/.exec(row)?.[1];
  if (!symbol) return null;

  const numbers = rowNumbers(row);
  if (numbers.length < NUMERIC_CELLS_PER_ROW) return null;

  const price = numbers[WATCH_COL.current];
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
  const changePoints = numbers[WATCH_COL.change];
  const changePercent = numbers[WATCH_COL.changePercent];
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
    volume: Math.round(numbers[WATCH_COL.volume]),
    isKmi30: codes.has("KMI30"),
    isKmiAllShare: codes.has("KMIALLSHR"),
  };
}

/**
 * Fetches and normalizes the live market-watch table. The raw PSX
 * payload never leaves this function.
 */
async function fetchMarketWatch(): Promise<MarketWatchResponse> {
  const html = await fetchMarketWatchHtml("market watch");

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

/* ── View: ETFs ────────────────────────────────────────────────── */

/*
 * NOT mutual funds: those are NAV-priced once daily and never trade on
 * the exchange, so they cannot come from this page at all and are out
 * of scope here (see src/types/etfs.ts).
 */

/**
 * PSX's own sector code for Exchange Traded Funds, read from the second
 * <td> of each row (the sector column carries a bare 4-digit code and
 * no name). This is the exchange's official classification — NOT a
 * guess from symbols ending in "ETF", which would be a naming
 * convention rather than a fact, and would silently break for any ETF
 * that does not follow it.
 *
 * Re-verified live against dps.psx.com.pk/market-watch: of 492 parsed
 * rows, exactly 9 carry 0837, and that set is IDENTICAL to the set of
 * rows PSX links under its own /etf/<symbol> URL path rather than
 * /company/<symbol> — two independent signals from the same page
 * agreeing exactly, with no symbol appearing under one and not the
 * other. If those signals ever disagree, prefer neither silently:
 * investigate, because it means PSX changed something.
 */
const ETF_SECTOR_CODE = "0837";

/**
 * Column positions within each row's numeric data-order sequence:
 *   0 LDCP · 1 OPEN · 2 HIGH · 3 LOW · 4 CURRENT · 5 CHANGE ·
 *   6 CHANGE% · 7 VOLUME
 * The watch view maps only current/change/percent/volume; ldcp/high/low
 * are surfaced here because ETF investors track them.
 */
const ETF_COL = {
  ldcp: 0,
  high: 2,
  low: 3,
  current: 4,
  change: 5,
  changePercent: 6,
  volume: 7,
};

/**
 * Structural floor for the WHOLE page (PSX lists ~490 symbols). Checked
 * separately from the ETF count so a broken page — which would yield
 * zero ETFs — is never mistaken for "PSX delisted every ETF".
 */
const MIN_TOTAL_ROWS = 50;

/**
 * Floor for the ETF set itself. Deliberately below the 9 currently
 * listed: ETFs get listed and delisted, and one delisting must not
 * blank the page. A collapse to near-zero, though, means the sector
 * code or the page changed — fall through to lastGood rather than
 * render a misleadingly short table.
 */
const MIN_ETFS = 5;

/** PSX titles are plain text bar the odd entity and doubled space. */
function decodeName(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One market-watch row → an ETF quote, or null if the row is not an ETF
 * or does not parse cleanly.
 *
 * Symbol comes from the row's data-search attribute, which carries the
 * bare ticker. Rows can display a trailing ex-dividend style flag
 * ("XD") beside the visible symbol — verified live that the flag lives
 * only in the rendered text and never in data-search, so no stripping
 * is needed (MIIETF was carrying XD at time of writing and extracted
 * clean).
 */
function parseEtfRow(row: string): EtfQuote | null {
  const symbol = /data-search="([A-Z0-9.\-]+)"/.exec(row)?.[1];
  if (!symbol) return null;

  // Sector cell: the bare 4-digit code. Anchored to the first such cell
  // so a numeric value elsewhere in the row can never stand in for it.
  const sector = /<td>(\d{4})<\/td>/.exec(row)?.[1];
  if (sector !== ETF_SECTOR_CODE) return null;

  const numbers = rowNumbers(row);
  if (numbers.length < NUMERIC_CELLS_PER_ROW) return null;

  const price = numbers[ETF_COL.current];
  const ldcp = numbers[ETF_COL.ldcp];
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(ldcp) || ldcp <= 0) return null;

  /*
   * Same self-consistency check the watch parser uses: change and
   * change% are parsed independently, so a column-misaligned row
   * disagrees with itself. Here LDCP is parsed too, which gives a
   * second, stronger cross-check — the change must reconcile against
   * PSX's own previous close rather than an inferred one.
   */
  const changePoints = numbers[ETF_COL.change];
  const changePercent = numbers[ETF_COL.changePercent];
  const impliedPercent = (changePoints / ldcp) * 100;
  const tolerance = Math.max(0.15, Math.abs(changePercent) * 0.03);
  if (Math.abs(impliedPercent - changePercent) > tolerance) return null;

  const high = numbers[ETF_COL.high];
  const low = numbers[ETF_COL.low];

  /*
   * Fund name from the symbol link's data-title. Falls back to the
   * ticker rather than inventing a name — the table must never show a
   * fund under a label PSX did not publish.
   */
  const title = /data-title="([^"]*)"/.exec(row)?.[1];
  const name = title ? decodeName(title) : symbol;

  return {
    symbol,
    name,
    price: round2(price),
    ldcp: round2(ldcp),
    high: round2(high),
    low: round2(low),
    changePoints: round2(changePoints),
    changePercent: round2(changePercent),
    direction: changePoints >= 0 ? "up" : "down",
    volume: Math.round(numbers[ETF_COL.volume]),
  };
}

async function fetchEtfs(): Promise<EtfsResponse> {
  const html = await fetchMarketWatchHtml("etfs");

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  /*
   * Structural check first: count rows that look like symbol rows at
   * all, independent of sector. If the page itself changed shape we
   * must not conclude "there are no ETFs".
   */
  const symbolRows = rows.filter((r) => /data-search="[A-Z0-9.\-]+"/.test(r));
  if (symbolRows.length < MIN_TOTAL_ROWS) {
    throw new Error(
      `PSX market-watch yielded only ${symbolRows.length} symbol rows — page structure may have changed`,
    );
  }

  const etfs: EtfQuote[] = [];
  for (const row of symbolRows) {
    const etf = parseEtfRow(row);
    if (etf) etfs.push(etf);
  }
  if (etfs.length < MIN_ETFS) {
    throw new Error(
      `PSX yielded only ${etfs.length} ETF rows for sector ${ETF_SECTOR_CODE} across ${symbolRows.length} symbols — sector code or page may have changed`,
    );
  }

  // Most actively traded first: the liquid ETFs are the ones a visitor
  // is most likely looking for. PSX's own row order is alphabetical by
  // nothing in particular.
  etfs.sort((a, b) => b.volume - a.volume);

  return { etfs, asOf: new Date().toISOString(), source: "psx" };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Approximate PSX session window (Mon–Fri, 09:00–16:45 PKT, covering
 * the split Friday sessions) — drives cache duration only. Both views
 * read the same PSX-listed table, so they share the PKT exchange
 * session, unlike the PMEX endpoints which follow international hours
 * and derive freshness from the data itself.
 */
function isPktSessionWindow(now = new Date()): boolean {
  const pkt = new Date(now.getTime() + PKT_OFFSET_MS);
  const day = pkt.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 16 * 60 + 45;
}

/*
 * One lastGood PER VIEW, exactly as the two originals each had their
 * own. Sharing a single slot would let one view's outage serve the
 * other view's shape. Both survive warm invocations and are the
 * graceful answer when PSX is down.
 */
let lastGoodWatch: MarketWatchResponse | null = null;
let lastGoodEtfs: EtfsResponse | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const view = String(req.query.view ?? "watch");

  if (view !== "watch" && view !== "etfs") {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({
      error: `Unknown PSX market-watch view "${view}" — expected "watch" or "etfs"`,
    });
    return;
  }

  try {
    const data = view === "watch" ? await fetchMarketWatch() : await fetchEtfs();
    if (view === "watch") {
      lastGoodWatch = data as MarketWatchResponse;
    } else {
      lastGoodEtfs = data as EtfsResponse;
    }
    res.setHeader(
      "Cache-Control",
      isPktSessionWindow()
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error(
      view === "watch"
        ? "PSX market-watch fetch failed:"
        : "PSX ETF fetch failed:",
      error,
    );
    const lastGood = view === "watch" ? lastGoodWatch : lastGoodEtfs;
    if (lastGood) {
      // Serve the last verified table, clearly labelled — never
      // fabricate market data, and never render a partial one.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error:
        view === "watch"
          ? "PSX market-watch data is temporarily unavailable"
          : "PSX ETF data is temporarily unavailable",
    });
  }
}
