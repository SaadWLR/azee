/** TEMPORARY — hamariweb open-market rates reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

const URL_ = "https://hamariweb.com/finance/forex/open_market_rates.aspx";

export default async function handler(): Promise<Response> {
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
    };
  } catch (error) {
    result = { error: String(error).slice(0, 180) };
  }
  return new Response(JSON.stringify({ runtime: "edge", hamariweb: result }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
