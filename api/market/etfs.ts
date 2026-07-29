import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { EtfQuote, EtfsResponse } from "../../src/types/etfs";

/**
 * GET /api/market/etfs
 *
 * Live quotes for every Exchange Traded Fund listed on the Pakistan
 * Stock Exchange. ETFs are ordinary exchange-traded instruments to PSX,
 * so they already appear in the same market-watch table the /api/market
 * /watch endpoint sweeps — this endpoint is a filtered, ETF-shaped view
 * of that same page, not a new data source.
 *
 * NOT mutual funds: those are NAV-priced once daily and never trade on
 * the exchange, so they cannot come from this page at all and are out
 * of scope here (see src/types/etfs.ts).
 *
 * The PSX adapter is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects (see api/market/snapshot.ts). Type-only
 * imports above are erased at compile time and safe.
 *
 * RUNTIME: Node — dps.psx.com.pk is Node-reachable and Edge-blocked
 * (HTTP 462 from Edge egress), same as every other PSX endpoint here.
 */

// Inlined per the no-relative-runtime-imports rule above; a shared init
// module would be exactly that import pattern. No DSN → silent no-op.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const MARKET_WATCH_URL = "https://dps.psx.com.pk/market-watch";

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
 * The market-watch endpoint maps only current/change/percent/volume;
 * ldcp/high/low are surfaced here because ETF investors track them.
 */
const COL = {
  ldcp: 0,
  high: 2,
  low: 3,
  current: 4,
  change: 5,
  changePercent: 6,
  volume: 7,
};
const NUMERIC_CELLS_PER_ROW = 8;

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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

  const numbers: number[] = [];
  for (const match of row.matchAll(/data-order="(-?[0-9][0-9.]*)"/g)) {
    numbers.push(Number(match[1]));
  }
  if (numbers.length < NUMERIC_CELLS_PER_ROW) return null;

  const price = numbers[COL.current];
  const ldcp = numbers[COL.ldcp];
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(ldcp) || ldcp <= 0) return null;

  /*
   * Same self-consistency check the market-watch parser uses: change
   * and change% are parsed independently, so a column-misaligned row
   * disagrees with itself. Here LDCP is parsed too, which gives a
   * second, stronger cross-check — the change must reconcile against
   * PSX's own previous close rather than an inferred one.
   */
  const changePoints = numbers[COL.change];
  const changePercent = numbers[COL.changePercent];
  const impliedPercent = (changePoints / ldcp) * 100;
  const tolerance = Math.max(0.15, Math.abs(changePercent) * 0.03);
  if (Math.abs(impliedPercent - changePercent) > tolerance) return null;

  const high = numbers[COL.high];
  const low = numbers[COL.low];

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
    volume: Math.round(numbers[COL.volume]),
  };
}

async function fetchEtfs(): Promise<EtfsResponse> {
  const response = await fetch(MARKET_WATCH_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (etfs)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for market-watch`);
  }
  const html = await response.text();

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
 * Approximate PSX session window (Mon–Fri, 09:00–16:45 PKT) — drives
 * cache duration only. Duplicated rather than shared with watch.ts per
 * the no-relative-runtime-imports constraint. ETFs trade on PSX, so
 * this is the PKT exchange session, unlike the PMEX commodity/futures
 * endpoints which follow international hours and derive freshness from
 * the data itself.
 */
function isPktSessionWindow(now = new Date()): boolean {
  const pkt = new Date(now.getTime() + PKT_OFFSET_MS);
  const day = pkt.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 16 * 60 + 45;
}

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: EtfsResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const data = await fetchEtfs();
    lastGood = data;
    res.setHeader(
      "Cache-Control",
      isPktSessionWindow()
        ? "s-maxage=60, stale-while-revalidate=300"
        : "s-maxage=1800, stale-while-revalidate=86400",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("PSX ETF fetch failed:", error);
    if (lastGood) {
      // Serve the last verified table, clearly labelled — never
      // fabricate market data, and never render a partial one.
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=600");
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "PSX ETF data is temporarily unavailable",
    });
  }
}

export { fetchEtfs };
