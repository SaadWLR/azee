import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY — PKR forex source reachability probe (Node). Deleted after decision. */
const TARGETS: Record<string, string> = {
  sbpHome: "https://www.sbp.org.pk/",
  forexComPk: "https://www.forex.com.pk/",
  forexPkOpenMarket: "https://www.forex.pk/open_market_rates.asp",
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const out: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(TARGETS)) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0 (fx probe)" },
      });
      const text = await r.text();
      out[name] = {
        status: r.status,
        bytes: text.length,
        hasRate: /27[0-9]\.[0-9]{2}/.test(text),
      };
    } catch (error) {
      out[name] = { error: String(error).slice(0, 160) };
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", targets: out });
}
