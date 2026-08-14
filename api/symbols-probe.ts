import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * TEMPORARY reachability probe — dps.psx.com.pk/symbols from Node.
 *
 * The old "reachable" finding predates several sources going dark this
 * session (SBP flipped from working to blocked), so it is re-verified
 * rather than trusted before being wired into a live endpoint.
 *
 * DELETE THIS FILE once the result is recorded.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  try {
    const r = await fetch("https://dps.psx.com.pk/symbols", {
      headers: { Accept: "application/json", "User-Agent": "azee-trade-web/1.0" },
    });
    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* left null — reported below */
    }
    const rows = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      runtime: "node",
      status: r.status,
      ms: Date.now() - started,
      contentType: r.headers.get("content-type"),
      server: r.headers.get("server"),
      bytes: text.length,
      isJsonArray: Array.isArray(parsed),
      count: rows.length,
      keys: rows.length ? Object.keys(rows[0]).sort() : [],
      sample: rows.slice(0, 3),
      etfCount: rows.filter((x) => x.isETF === true).length,
      debtCount: rows.filter((x) => x.isDebt === true).length,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ runtime: "node", ms: Date.now() - started, error: String(e) });
  }
}
