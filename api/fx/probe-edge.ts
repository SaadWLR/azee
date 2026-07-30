/** TEMPORARY — PKR forex source reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

const TARGETS: Record<string, string> = {
  sbpHome: "https://www.sbp.org.pk/",
  forexComPk: "https://www.forex.com.pk/",
  forexPkOpenMarket: "https://www.forex.pk/open_market_rates.asp",
};

export default async function handler(): Promise<Response> {
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
  return new Response(JSON.stringify({ runtime: "edge", targets: out }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
