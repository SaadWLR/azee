import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY — Tribune reachability probe (Node). Deleted after decision. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = "https://tribune.com.pk/feed/business";
  let result: unknown;
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "azee-trade-web/1.0 (market news)",
      },
    });
    const body = await r.text();
    result = {
      status: r.status,
      bytes: body.length,
      items: (body.match(/<item[\s>]/g) ?? []).length,
      looksRight: body.includes("<rss") || body.includes("<item"),
    };
  } catch (error) {
    result = { error: String(error).slice(0, 150) };
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", tribune: result });
}
