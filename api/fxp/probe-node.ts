import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * TEMPORARY — FX provider host-reachability probe (Node). Deleted after decision.
 *
 * No API keys are used or needed: a 403/401 "missing key" response still
 * proves the host is reachable from Vercel's egress, which is the only
 * question here.
 */
const TARGETS: Record<string, string> = {
  openExchangeRates: "https://openexchangerates.org/api/latest.json",
  exchangeRateApiOpen: "https://open.er-api.com/v6/latest/USD",
  exchangeRatesApiIo: "https://api.exchangeratesapi.io/v1/latest",
  fawazahmed0Cdn:
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
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
        reachable: true,
        hasPkr: /"?[Pp][Kk][Rr]"?\s*:/.test(text),
      };
    } catch (error) {
      out[name] = { reachable: false, error: String(error).slice(0, 150) };
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", targets: out });
}
