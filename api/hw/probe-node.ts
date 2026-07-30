import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY — hamariweb open-market rates reachability probe (Node). Deleted after decision. */
const URL_ = "https://hamariweb.com/finance/forex/open_market_rates.aspx";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  let result: unknown;
  try {
    const r = await fetch(URL_, {
      headers: { "User-Agent": "azee-trade-web/1.0 (fx probe)" },
    });
    const text = await r.text();
    const table = /<table[\s\S]*?<\/table>/.exec(text)?.[0] ?? "";
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].length;
    result = {
      status: r.status,
      bytes: text.length,
      hasTable: table.length > 0,
      tableRows: rows,
      usdPresent: /US Dollar/.test(text),
      sampleUsd: /US Dollar[\s\S]{0,120}?([0-9]{3}\.[0-9]{2})[\s\S]{0,60}?([0-9]{3}\.[0-9]{2})/.exec(
        text.replace(/<[^>]*>/g, " "),
      )?.slice(1, 3),
    };
  } catch (error) {
    result = { error: String(error).slice(0, 180) };
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", hamariweb: result });
}
