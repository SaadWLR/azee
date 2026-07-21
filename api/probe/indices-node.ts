import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY probe — Node runtime reachability of dps.psx.com.pk/indices. Delete after Step 1. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch("https://dps.psx.com.pk/indices", {
      headers: {
        Accept: "text/html",
        "User-Agent": "azee-trade-web/1.0 (indices probe)",
      },
    });
    const text = await r.text();
    res.status(200).json({
      runtime: "node",
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      length: text.length,
      hasKSE100: text.includes("KSE100"),
      hasIndicesTable: text.includes("data-code"),
      sample: text.slice(0, 120),
    });
  } catch (error) {
    res.status(200).json({ runtime: "node", error: String(error) });
  }
}
