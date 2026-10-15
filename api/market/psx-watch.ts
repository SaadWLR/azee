import { timingSafeEqual } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  MarketStat,
  MarketBreadth,
  MarketWatchResponse,
  StockQuote,
} from "../../src/types";
import type { EtfQuote, EtfsResponse } from "../../src/types/etfs";
import type {
  MarketWatchFeedEnvelope,
  StoredMarketWatchFeed,
} from "../../src/types/feed";

/**
 * GET /api/market/psx-watch?view=watch | etfs
 * POST /api/market/psx-watch?view=watch — office feed ingest (see
 * "Office feed" below; wire format in src/types/feed.ts)
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

/* ── Symbol directory (company names + sector names) ───────────── */

/**
 * PSX's own symbol directory: the ONLY place on the portal that
 * publishes a listed company's full name and its sector NAME. The
 * market-watch table carries a bare 4-digit sector code with no name
 * mapping, which is why the Screener showed tickers alone until now.
 *
 * Re-verified live from Vercel Node before wiring in (200, ~580 ms,
 * 1002 entries, nginx — no Cloudflare in front, unlike the sources
 * that went dark this session). Its isETF flag independently reports 9
 * ETFs, exactly matching the sector-0837 set api/market/psx-watch's
 * ETF view derives — two unrelated signals from PSX agreeing.
 */
const SYMBOLS_URL = "https://dps.psx.com.pk/symbols";

interface PsxSymbolEntry {
  symbol: string;
  name: string;
  sectorName: string;
  isETF: boolean;
  isDebt: boolean;
}

/** symbol → { name, sector }, or an empty map if the directory fails. */
type SymbolDirectory = Map<string, { name: string; sector: string }>;

/**
 * Fetches the symbol directory. NEVER throws: this is enrichment on top
 * of the quote table, so a directory outage must degrade the Screener
 * to bare tickers — exactly what it showed before — rather than take
 * the whole market-watch endpoint down with it. Returns an empty map on
 * any failure, and the join below then simply finds no match.
 */
async function fetchSymbolDirectory(): Promise<SymbolDirectory> {
  const directory: SymbolDirectory = new Map();
  try {
    const response = await fetch(SYMBOLS_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "azee-trade-web/1.0 (symbol directory)",
      },
    });
    if (!response.ok) {
      throw new Error(`PSX responded ${response.status} for symbols`);
    }
    const entries = (await response.json()) as PsxSymbolEntry[];
    if (!Array.isArray(entries)) {
      throw new Error("PSX returned a non-array symbol directory");
    }
    for (const entry of entries) {
      if (typeof entry?.symbol !== "string") continue;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const sector =
        typeof entry.sectorName === "string" ? entry.sectorName.trim() : "";
      // A blank field is left absent rather than stored as "" — the UI
      // then falls back to the ticker instead of rendering a gap.
      if (!name && !sector) continue;
      directory.set(entry.symbol, { name, sector });
    }
  } catch (error) {
    // Logged, not thrown. Quotes are the product; names are a bonus.
    console.warn("PSX symbol directory unavailable; serving bare tickers:", error);
  }
  return directory;
}

/* ── View: full market watch ───────────────────────────────────── */

/** Column positions within each row's numeric data-order sequence. */
const WATCH_COL = {
  ldcp: 0,
  open: 1,
  high: 2,
  low: 3,
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

  /*
   * Session open/high/low were parsed from every row all along — they
   * sit in the same numbers array as the fields above — and simply went
   * unread until the company detail page had a use for them. No extra
   * fetch or parse pass: three more reads of data already in hand.
   *
   * A ZERO IS "NOT PUBLISHED", NOT A PRICE. PSX prints 0 for these
   * columns on symbols it has no session range for, including some that
   * carry a non-zero volume (measured 2026-09-20: PRWM and GCWLPRS, both
   * open/high/low 0 with volume 8 and 6). Passing a 0 through would put
   * "0.00 – 0.00" on a page as if it were a real day range, so the field
   * is left absent instead and the UI shows nothing for it.
   */
  const published = (value: number): number | undefined =>
    Number.isFinite(value) && value > 0 ? round2(value) : undefined;

  return {
    symbol,
    price: round2(price),
    changePercent: round2(changePercent),
    changePoints: round2(changePoints),
    volume: Math.round(numbers[WATCH_COL.volume]),
    open: published(numbers[WATCH_COL.open]),
    dayHigh: published(numbers[WATCH_COL.high]),
    dayLow: published(numbers[WATCH_COL.low]),
    /*
     * The previous close the check above already derived. It is not a
     * second opinion on PSX's own LDCP column: measured across all 495
     * rows on 2026-09-20, price − change equalled LDCP everywhere except
     * the misaligned "786" row, which this parser drops anyway.
     */
    previousClose: round2(previousClose),
    isKmi30: codes.has("KMI30"),
    isKmiAllShare: codes.has("KMIALLSHR"),
  };
}

/**
 * Session stats and breadth derived from a complete quote board.
 * Shared by the portal path and the office-feed read path, so a feed
 * snapshot that omits its own stats or breadth gets exactly the
 * figures the portal path would compute from the same quotes — derived
 * from that one board only, never mixed with another source.
 */
function deriveSession(quotes: StockQuote[]): {
  stats: MarketStat[];
  breadth: MarketBreadth;
} {
  const totalVolume = quotes.reduce((sum, q) => sum + (q.volume ?? 0), 0);
  const advancers = quotes.filter((q) => q.changePercent > 0).length;
  const decliners = quotes.filter((q) => q.changePercent < 0).length;

  const stats: MarketStat[] = [
    { label: "Market Volume", value: formatShares(totalVolume) },
    { label: "Advancers", value: String(advancers), direction: "up" },
    { label: "Decliners", value: String(decliners), direction: "down" },
    { label: "Symbols Traded", value: String(quotes.length) },
  ];

  /*
   * The same breadth, as NUMBERS.
   *
   * Additive on purpose: `stats` above is unchanged, down to the
   * counts, because several consumers render those strings verbatim.
   * This block re-exposes the identical advancer/decliner figures in a
   * form that can be computed with, so the sentiment layer never has
   * to parse "291" back out of our own display copy.
   *
   * `unchanged` is derived by subtraction rather than filtered
   * separately, so the three counts are guaranteed to sum to the
   * symbols-traded figure the stats array already publishes — they can
   * never disagree with each other.
   *
   * THE VOLUME SUMS APPLY A LIQUIDITY FILTER; the counts do not. PSX's
   * table carries a price change for symbols that did not actually
   * trade (the change is read against LDCP), so a zero-volume symbol
   * is a real directional data point but carries no conviction. It
   * counts as an advancer or decliner and contributes nothing to the
   * volume weighting. Everything here is summed from the parsed rows —
   * no second fetch, no new upstream.
   */
  const traded = quotes.filter((q) => (q.volume ?? 0) > 0);
  const breadth: MarketBreadth = {
    advancers,
    decliners,
    unchanged: quotes.length - advancers - decliners,
    advancingVolume: traded
      .filter((q) => q.changePercent > 0)
      .reduce((sum, q) => sum + (q.volume ?? 0), 0),
    decliningVolume: traded
      .filter((q) => q.changePercent < 0)
      .reduce((sum, q) => sum + (q.volume ?? 0), 0),
  };

  return { stats, breadth };
}

/**
 * Fetches and normalizes the live market-watch table. The raw PSX
 * payload never leaves this function.
 */
async function fetchMarketWatch(): Promise<MarketWatchResponse> {
  /*
   * Both upstreams in parallel so the directory costs no added latency
   * on the critical path — the market-watch page is the slower of the
   * two, and this settles in about the time that one takes alone. The
   * directory is allSettled-style by construction (it never rejects),
   * so only the quote table can fail the request.
   */
  const [html, directory] = await Promise.all([
    fetchMarketWatchHtml("market watch"),
    fetchSymbolDirectory(),
  ]);

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const quotes: StockQuote[] = [];
  for (const row of rows) {
    const quote = parseRow(row);
    if (!quote) continue;
    /*
     * Join by ticker. A symbol present in one source but not the other
     * is normal — the directory carries 1002 entries (including debt
     * instruments that never appear on the ready board) against ~490
     * quoted symbols — so an unmatched quote keeps its bare ticker and
     * is never dropped, and a directory entry with no quote is simply
     * not rendered. Absent fields stay absent; nothing is invented.
     */
    const entry = directory.get(quote.symbol);
    if (entry?.name) quote.name = entry.name;
    if (entry?.sector) quote.sector = entry.sector;
    quotes.push(quote);
  }
  if (quotes.length < MIN_VALID_ROWS) {
    throw new Error(
      `PSX market-watch parse yielded only ${quotes.length} valid rows — page structure may have changed`,
    );
  }

  const { stats, breadth } = deriveSession(quotes);

  return {
    quotes,
    stats,
    breadth,
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

/* ── Office feed: ingest (POST) and feed-first read ────────────── */

/*
 * AZEE's office receives PSX's live feed from a broadcaster. An agent
 * there POSTs normalized snapshots (wire format v1, src/types/feed.ts)
 * to /api/market/watch; GET then serves the latest accepted snapshot
 * ahead of the portal scrape. With no snapshot stored, the GET path is
 * exactly the portal path below, unchanged.
 *
 * AUTH is three-way, as in api/economic/dashboard.ts:
 *  - POST with no Authorization → 401.
 *  - POST with Authorization that isn't `Bearer ${FEED_INGEST_SECRET}`
 *    → 401. That includes every header when FEED_INGEST_SECRET is
 *    unset: with nothing to match, the route can never write.
 *  - matching → validate, then store.
 * GET never needs a credential. Every other method gets a 405 so a
 * write can only ever arrive as an authenticated POST. Neither the
 * secret nor the body is ever logged; rejections log a reason code.
 *
 * RATE. The agent POSTs at most once per 10 s. The Vercel Firewall
 * allows 30 requests / 60 s per IP on /api/*, and the agent's POSTs
 * carry no bypass header, so its total across ALL kinds must stay
 * under 20/min to leave headroom for retries.
 *
 * QUOTA. The KV store is Upstash's Free plan: 500K commands/month and
 * 10 GB bandwidth/month, shared with the economic dashboard and the
 * breadth recorder. A ~495-symbol board is ~133 KB of JSON, so the
 * stored blob is gzipped (~37 KB as base64) — uncompressed, the writes
 * alone at one per 10 s across a session would use most of the 10 GB.
 * Each accepted POST is one small GET (the meta key below) plus one
 * MSET; validation never reads the big blob. GETs are served through
 * the CDN, so KV is read only on a cache miss.
 *
 * ENVIRONMENT ISOLATION. Production and Preview share one KV store
 * (the integration injects the same KV_REST_API_* into both), so every
 * key outside production carries a "preview:" prefix. A preview, a
 * local run or a test can never read or write production's snapshot.
 */

const FEED_KEY = "feed:market-watch";

/** Body cap. A full board is ~133 KB; 1 MB is generous headroom. */
const FEED_MAX_BODY_BYTES = 1_000_000;

/** Upper bound on symbols in one snapshot (PSX quotes ~495 today). */
const FEED_MAX_QUOTES = 3_000;

/**
 * How far ahead of the site's clock asOf may be. PSX's clock and
 * Vercel's will never agree to the second; two minutes absorbs that
 * skew while still rejecting a mis-zoned timestamp (an hour or more).
 */
const FEED_MAX_FUTURE_MS = 2 * 60 * 1000;

/**
 * PARTIAL-READ GUARD. A snapshot with fewer than this fraction of the
 * previous accepted snapshot's symbols is rejected as a likely partial
 * log read. A HEURISTIC, not a PSX rule: PSX publishes no minimum
 * board size, and a real mass suspension would be rejected too until
 * the agent's read recovers.
 */
const FEED_MIN_SYMBOL_RATIO = 0.8;

/**
 * Stale threshold, applied ONLY when the feed itself says the market
 * is open. The agent sends at most every 10 s, so 120 s is a dozen
 * missed sends — long enough that it means the agent or the
 * broadcaster stopped, not that one POST was slow. Outside an open
 * session a quiet feed is expected, and nothing is claimed.
 */
const FEED_STALE_AFTER_MS = 120 * 1000;

/** The same character class the portal parser accepts in data-search. */
const FEED_SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,20}$/;

/** ISO-8601 with an explicit offset — a bare local time is ambiguous. */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

function feedNamespace(): { prefix: string; name: "production" | "preview" } {
  return process.env.VERCEL_ENV === "production"
    ? { prefix: "", name: "production" }
    : { prefix: "preview:", name: "preview" };
}

function feedKeys(): { data: string; meta: string } {
  const { prefix } = feedNamespace();
  return { data: `${prefix}${FEED_KEY}`, meta: `${prefix}${FEED_KEY}:meta` };
}

/** What validation needs from the previous snapshot, kept apart from the blob. */
interface FeedMeta {
  asOf: string;
  symbols: number;
}

/* KV REST client, inlined from api/economic/dashboard.ts (no relative runtime imports). */
function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

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

function encodeSnapshot(snapshot: StoredMarketWatchFeed): string {
  return gzipSync(JSON.stringify(snapshot)).toString("base64");
}

function decodeSnapshot(raw: string): StoredMarketWatchFeed {
  return JSON.parse(
    gunzipSync(Buffer.from(raw, "base64")).toString("utf8"),
  ) as StoredMarketWatchFeed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Constant-time `Bearer ${FEED_INGEST_SECRET}` check; false when unset. */
function ingestAuthorized(header: string | undefined): boolean {
  const secret = process.env.FEED_INGEST_SECRET;
  if (!secret || header === undefined) return false;
  const given = Buffer.from(header, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  // timingSafeEqual throws on unequal lengths; the length itself is not
  // secret-dependent beyond what the scheme already reveals.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

type Rejection = { reason: string; detail?: string };
type Validated = { ok: true; envelope: MarketWatchFeedEnvelope } | ({ ok: false } & Rejection);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const shortString = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

/**
 * One quote, rebuilt field by field from the known StockQuote shape.
 * Unknown fields are dropped rather than stored, so the site only ever
 * serves fields it understands. Prices must be > 0 (an unpublished one
 * is omitted, never 0); volume is a whole, non-negative share count;
 * changes may be negative but must be finite.
 */
function validateQuote(raw: unknown, at: number): StockQuote | Rejection {
  const where = `quotes[${at}]`;
  if (!isRecord(raw)) return { reason: "bad_quote", detail: where };
  if (typeof raw.symbol !== "string" || !FEED_SYMBOL_PATTERN.test(raw.symbol)) {
    return { reason: "bad_symbol", detail: where };
  }
  if (!positive(raw.price)) return { reason: "bad_number", detail: `${where}.price` };
  if (!finite(raw.changePercent)) {
    return { reason: "bad_number", detail: `${where}.changePercent` };
  }
  const quote: StockQuote = {
    symbol: raw.symbol,
    price: raw.price,
    changePercent: raw.changePercent,
  };
  if (raw.changePoints !== undefined) {
    if (!finite(raw.changePoints)) return { reason: "bad_number", detail: `${where}.changePoints` };
    quote.changePoints = raw.changePoints;
  }
  if (raw.volume !== undefined) {
    if (!count(raw.volume)) return { reason: "bad_number", detail: `${where}.volume` };
    quote.volume = raw.volume;
  }
  for (const field of ["open", "dayHigh", "dayLow", "previousClose"] as const) {
    if (raw[field] === undefined) continue;
    if (!positive(raw[field])) return { reason: "bad_number", detail: `${where}.${field}` };
    quote[field] = raw[field];
  }
  for (const field of ["name", "sector"] as const) {
    if (raw[field] === undefined) continue;
    if (!shortString(raw[field], 200)) return { reason: "bad_quote", detail: `${where}.${field}` };
    quote[field] = raw[field];
  }
  for (const field of ["isKmi30", "isKmiAllShare"] as const) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== "boolean") return { reason: "bad_quote", detail: `${where}.${field}` };
    quote[field] = raw[field];
  }
  return quote;
}

function validateEnvelope(body: unknown, now: number): Validated {
  const reject = (reason: string, detail?: string): Validated => ({ ok: false, reason, detail });

  if (!isRecord(body)) return reject("invalid_json");
  if (body.schema !== 1) return reject("bad_schema");
  if (body.kind !== "market-watch") return reject("bad_kind");
  if (body.complete !== true) return reject("incomplete");

  if (typeof body.asOf !== "string" || !ISO_WITH_OFFSET.test(body.asOf)) {
    return reject("bad_asof");
  }
  const asOfMs = Date.parse(body.asOf);
  if (!Number.isFinite(asOfMs)) return reject("bad_asof");
  if (asOfMs - now > FEED_MAX_FUTURE_MS) return reject("asof_in_future");

  if (
    typeof body.sentAt !== "string" ||
    !ISO_WITH_OFFSET.test(body.sentAt) ||
    !Number.isFinite(Date.parse(body.sentAt))
  ) {
    return reject("bad_sent_at");
  }

  const status = body.marketStatus;
  if (status !== undefined && status !== "open" && status !== "closed" && status !== "unknown") {
    return reject("bad_market_status");
  }

  if (!Array.isArray(body.quotes) || body.quotes.length === 0) return reject("no_quotes");
  if (body.quotes.length > FEED_MAX_QUOTES) return reject("too_many_quotes");
  const quotes: StockQuote[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < body.quotes.length; i++) {
    const result = validateQuote(body.quotes[i], i);
    if ("reason" in result) return reject(result.reason, result.detail);
    if (seen.has(result.symbol)) return reject("duplicate_symbol", `quotes[${i}]`);
    seen.add(result.symbol);
    quotes.push(result);
  }

  const envelope: MarketWatchFeedEnvelope = {
    schema: 1,
    kind: "market-watch",
    asOf: body.asOf,
    sentAt: body.sentAt,
    complete: true,
    quotes,
  };
  if (status !== undefined) envelope.marketStatus = status;

  if (body.breadth !== undefined) {
    const b = body.breadth;
    if (
      !isRecord(b) ||
      !count(b.advancers) ||
      !count(b.decliners) ||
      !count(b.unchanged) ||
      !count(b.advancingVolume) ||
      !count(b.decliningVolume)
    ) {
      return reject("bad_breadth");
    }
    envelope.breadth = {
      advancers: b.advancers,
      decliners: b.decliners,
      unchanged: b.unchanged,
      advancingVolume: b.advancingVolume,
      decliningVolume: b.decliningVolume,
    };
  }

  if (body.stats !== undefined) {
    if (!Array.isArray(body.stats) || body.stats.length > 20) return reject("bad_stats");
    const stats: MarketStat[] = [];
    for (let i = 0; i < body.stats.length; i++) {
      const s = body.stats[i];
      if (
        !isRecord(s) ||
        !shortString(s.label, 80) ||
        !shortString(s.value, 80) ||
        (s.direction !== undefined && s.direction !== "up" && s.direction !== "down")
      ) {
        return reject("bad_stats", `stats[${i}]`);
      }
      const stat: MarketStat = { label: s.label, value: s.value };
      if (s.direction !== undefined) stat.direction = s.direction;
      stats.push(stat);
    }
    envelope.stats = stats;
  }

  return { ok: true, envelope };
}

function rejectFeed(res: VercelResponse, status: number, rejection: Rejection) {
  // The reason code only — never the body, which is market data.
  console.warn(`Feed ingest rejected (${status}): ${rejection.reason}`);
  res.status(status).json({
    accepted: false,
    reason: rejection.reason,
    ...(rejection.detail ? { detail: rejection.detail } : {}),
  });
}

async function ingestFeed(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  // Which KV namespace this deployment writes to — lets a test refuse
  // to proceed before it ever sends a credential to production.
  res.setHeader("X-Feed-Namespace", feedNamespace().name);

  if (!ingestAuthorized(req.headers.authorization)) {
    console.warn("Feed ingest rejected (401): unauthorized");
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > FEED_MAX_BODY_BYTES) {
    rejectFeed(res, 400, { reason: "body_too_large" });
    return;
  }
  let body: unknown;
  try {
    body = req.body; // @vercel/node parses JSON lazily and throws on bad JSON
  } catch {
    rejectFeed(res, 400, { reason: "invalid_json" });
    return;
  }
  // A chunked body has no Content-Length; measure what actually arrived.
  if (isRecord(body) && Buffer.byteLength(JSON.stringify(body)) > FEED_MAX_BODY_BYTES) {
    rejectFeed(res, 400, { reason: "body_too_large" });
    return;
  }

  const now = Date.now();
  const result = validateEnvelope(body, now);
  if (!result.ok) {
    rejectFeed(res, 400, result);
    return;
  }
  const { envelope } = result;
  const keys = feedKeys();

  let previous: FeedMeta | null;
  try {
    const raw = (await kv(`/get/${encodeURIComponent(keys.meta)}`)).result;
    previous = raw ? (JSON.parse(raw) as FeedMeta) : null;
  } catch (error) {
    // Without the previous snapshot neither guard below can be checked,
    // so nothing is written.
    console.error("Feed ingest could not read the stored meta:", errorMessage(error));
    Sentry.captureException(error);
    rejectFeed(res, 503, { reason: "store_unavailable" });
    return;
  }

  if (previous) {
    /*
     * OUT-OF-ORDER: never replace a snapshot with an older one. An equal
     * asOf is accepted — a resend of the same tick, or a correction
     * PSX published under the same timestamp.
     */
    if (Date.parse(envelope.asOf) < Date.parse(previous.asOf)) {
      rejectFeed(res, 400, { reason: "out_of_order" });
      return;
    }
    if (envelope.quotes.length < previous.symbols * FEED_MIN_SYMBOL_RATIO) {
      rejectFeed(res, 400, { reason: "partial_snapshot" });
      return;
    }
  }

  const receivedAt = new Date(now).toISOString();
  const meta: FeedMeta = { asOf: envelope.asOf, symbols: envelope.quotes.length };
  try {
    // One MSET: blob and meta land together or not at all. Two agents
    // racing would be last-writer-wins; there is one agent, sending
    // serially, so that is accepted rather than paid for with a script.
    await kv("", {
      method: "POST",
      body: JSON.stringify([
        "MSET",
        keys.data,
        encodeSnapshot({ ...envelope, receivedAt }),
        keys.meta,
        JSON.stringify(meta),
      ]),
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feed ingest could not store the snapshot:", errorMessage(error));
    Sentry.captureException(error);
    rejectFeed(res, 503, { reason: "store_unavailable" });
    return;
  }

  res.status(200).json({
    accepted: true,
    asOf: envelope.asOf,
    symbols: envelope.quotes.length,
    receivedAt,
  });
}

/**
 * The stored feed snapshot, or null when there is none — or when KV is
 * unconfigured or failing, in which case the caller falls through to
 * the portal path exactly as it behaved before the feed existed.
 */
async function readFeedSnapshot(): Promise<StoredMarketWatchFeed | null> {
  if (!kvConfigured()) return null;
  try {
    const raw = (await kv(`/get/${encodeURIComponent(feedKeys().data)}`)).result;
    return raw ? decodeSnapshot(raw) : null;
  } catch (error) {
    console.error("Feed snapshot read failed; serving the portal path:", errorMessage(error));
    Sentry.captureException(error);
    return null;
  }
}

function serveFeed(res: VercelResponse, snapshot: StoredMarketWatchFeed) {
  /*
   * Stats and breadth as the feed sent them; where it sent none, derived
   * from the snapshot's own quotes exactly as the portal path derives
   * them. Never filled from the portal — one response, one source.
   */
  const derived = deriveSession(snapshot.quotes);
  const body: MarketWatchResponse = {
    quotes: snapshot.quotes,
    stats: snapshot.stats ?? derived.stats,
    breadth: snapshot.breadth ?? derived.breadth,
    asOf: snapshot.asOf,
    source: "feed",
  };
  // Freshness is claimed either way only when the feed says it's open.
  if (snapshot.marketStatus === "open") {
    body.stale = Date.now() - Date.parse(snapshot.asOf) > FEED_STALE_AFTER_MS;
  }

  /*
   * 5 s at the edge while the market may be moving, so a 10 s feed
   * reaches readers within one send; a minute otherwise, because a
   * closed board does not change and each miss costs a ~37 KB KV read
   * against the Free plan's bandwidth.
   */
  const live =
    snapshot.marketStatus === "open" ||
    (snapshot.marketStatus !== "closed" && isPktSessionWindow());
  res.setHeader(
    "Cache-Control",
    live
      ? "s-maxage=5, stale-while-revalidate=10"
      : "s-maxage=60, stale-while-revalidate=300",
  );
  res.status(200).json(body);
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

  // Writes arrive only as an authenticated POST to the watch view.
  if (req.method === "POST" && view === "watch") {
    await ingestFeed(req, res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Allow", view === "watch" ? "GET, HEAD, POST" : "GET, HEAD");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // Feed first; with no snapshot stored, everything below runs as before.
  if (view === "watch") {
    const snapshot = await readFeedSnapshot();
    if (snapshot) {
      serveFeed(res, snapshot);
      return;
    }
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
