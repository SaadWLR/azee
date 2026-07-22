import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  IndexConstituent,
  IndexConstituentsResponse,
} from "../../src/types/index-constituents";

/**
 * GET /api/market/index-constituents?code=<CODE>
 *
 * On-demand constituent companies of one PSX index, parsed from
 * dps.psx.com.pk/indices/<CODE> — the only public source carrying real
 * company NAMES and per-constituent index WEIGHTS. The frontend never
 * talks to PSX directly.
 *
 * RUNTIME: Node only — dps.psx.com.pk is Node-reachable, Edge-blocked
 * (HTTP 462), confirmed for the sibling /indices route; /indices/<CODE>
 * is the same host/path prefix and returns 200 from Node. Adapter
 * inlined (no relative runtime imports), per the project's Vercel
 * constraint.
 *
 * The `code` query param is validated against the fixed set of 10 known
 * indices before being interpolated into the PSX URL — arbitrary user
 * input is never passed through.
 */

/*
 * The 10 valid index codes and a per-index sanity floor: the minimum
 * plausible constituent count. Indices are fixed-size between periodic
 * rebalances (KSE-100 ~100, OGTI 3…), so a parse well below the floor
 * means the page structure changed — fall through to lastGood/503
 * rather than serve a truncated list. Floors sit ~30% under the known
 * counts to tolerate an occasional membership change without nuisance
 * failures.
 */
const MIN_CONSTITUENTS: Record<string, number> = {
  KSE100: 80,
  KSE30: 24,
  ALLSHR: 400,
  KMI30: 24,
  KMIALLSHR: 240,
  PSXDIV20: 15,
  BKTI: 6,
  OGTI: 2,
  UPP9: 6,
  NITPGI: 9,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Decodes the HTML entities that appear in company names ("Oil &amp; Gas…"). */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * A numeric cell value: the machine-readable data-order attribute when
 * present, otherwise the visible text with grouping/percent stripped
 * (the index-weight cell carries no data-order).
 */
function cellNum(cell: string): number {
  const dataOrder = /data-order="(-?[0-9][0-9.]*)"/.exec(cell);
  if (dataOrder) return Number(dataOrder[1]);
  const text = cell.replace(/<[^>]+>/g, "").replace(/[,%\s]/g, "");
  return Number(text);
}

/**
 * Parses one constituent row. Cell layout (verified live):
 *  [0] symbol (data-order=SYMBOL, data-title=company name)
 *  [1] name  [2] LDCP  [3] current  [4] change  [5] change%
 *  [6] index weight % (text only)  [7] index points  [8] volume
 *  [9] free float  [10] market cap
 */
function parseConstituent(row: string): IndexConstituent | null {
  const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
  if (!cells || cells.length < 11) return null;

  const symbol =
    /data-order="([A-Z0-9.\-]+)"/.exec(cells[0])?.[1] ??
    /\/company\/([A-Z0-9.\-]+)/.exec(cells[0])?.[1];
  if (!symbol) return null;
  const name = decodeEntities(
    /data-title="([^"]+)"/.exec(cells[0])?.[1] ??
      cells[1].replace(/<[^>]+>/g, "").trim(),
  );

  const current = cellNum(cells[3]);
  if (!Number.isFinite(current) || current <= 0) return null;

  const values = {
    ldcp: cellNum(cells[2]),
    current,
    change: cellNum(cells[4]),
    changePercent: cellNum(cells[5]),
    indexWeight: cellNum(cells[6]),
    indexPoints: cellNum(cells[7]),
    volume: cellNum(cells[8]),
    freeFloat: cellNum(cells[9]),
    marketCap: cellNum(cells[10]),
  };

  return {
    symbol,
    name,
    ldcp: round2(values.ldcp),
    current: round2(values.current),
    change: round2(values.change),
    changePercent: round2(values.changePercent),
    indexWeight: round2(values.indexWeight),
    indexPoints: round2(values.indexPoints),
    volume: Math.round(values.volume),
    freeFloat: Math.round(values.freeFloat),
    marketCap: Math.round(values.marketCap),
  };
}

async function fetchConstituents(
  code: string,
): Promise<IndexConstituentsResponse> {
  const response = await fetch(`https://dps.psx.com.pk/indices/${code}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (index constituents)",
    },
  });
  if (!response.ok) {
    throw new Error(`PSX responded ${response.status} for indices/${code}`);
  }
  const html = await response.text();

  // Only rows with a company link are constituents (skips the header).
  const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []).filter((r) =>
    /tbl__symbol|\/company\//.test(r),
  );
  const constituents: IndexConstituent[] = [];
  for (const row of rows) {
    const parsed = parseConstituent(row);
    if (parsed) constituents.push(parsed);
  }

  const floor = MIN_CONSTITUENTS[code];
  if (constituents.length < floor) {
    throw new Error(
      `PSX indices/${code} parsed only ${constituents.length} constituents (floor ${floor}) — page structure may have changed`,
    );
  }

  return {
    code,
    count: constituents.length,
    constituents,
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Per-code last-known-good; the graceful answer when a fetch fails. */
const lastGood = new Map<string, IndexConstituentsResponse>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const raw = req.query.code;
  const code = (typeof raw === "string" ? raw : "").toUpperCase();

  // Validate against the fixed known set — never interpolate arbitrary
  // input into the PSX URL.
  if (!(code in MIN_CONSTITUENTS)) {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({ error: "Unknown or missing index code" });
    return;
  }

  try {
    const data = await fetchConstituents(code);
    lastGood.set(code, data);
    /*
     * 15 minutes in-session, 1 hour otherwise — deliberately far longer
     * than indices-full's 60s. An index's composition and weights only
     * change at periodic (quarterly) rebalances, so the drill-down's
     * primary payload — which companies, at what weight — is effectively
     * static intraday. The embedded live prices are secondary in a
     * "what's in this index" view, and each fetch scrapes a large HTML
     * page (ALLSHR ~400KB), so a long window keeps that cost off PSX
     * while the composition stays correct. Out of session everything is
     * the static last close.
     */
    res.setHeader(
      "Cache-Control",
      "s-maxage=900, stale-while-revalidate=3600",
    );
    res.status(200).json(data);
  } catch (error) {
    console.error(`Constituents fetch failed for ${code}:`, error);
    const cached = lastGood.get(code);
    if (cached) {
      // Serve the last verified constituents for this code, clearly
      // labelled — never fabricate rows.
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
      res.status(200).json({ ...cached, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Index constituent data is temporarily unavailable",
    });
  }
}
