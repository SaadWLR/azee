import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY reachability probe (Node) for dportal.pmex.com.pk. Deleted after research. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch("https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "azee-trade-web/1.0 (pmex probe)" },
      body: "{}",
    });
    const text = await r.text();
    let arr: unknown = null;
    try { arr = JSON.parse(text); } catch { /* keep null */ }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      runtime: "node",
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      isArray: Array.isArray(arr),
      count: Array.isArray(arr) ? arr.length : null,
      indicesCount: Array.isArray(arr) ? (arr as { Category?: string }[]).filter((c) => c.Category === "Indices").length : null,
      sample: text.slice(0, 60),
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ runtime: "node", error: String(e) });
  }
}
