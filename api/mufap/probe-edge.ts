/** TEMPORARY — MUFAP reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

const TARGETS: Record<string, string> = {
  navAndSalesLoad: "https://mufap.com.pk/Industry/IndustryStatDaily?tab=3",
  fundDirectory: "https://mufap.com.pk/FundProfile/FundDirectory",
};

export default async function handler(): Promise<Response> {
  const out: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(TARGETS)) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0 (mufap probe)" },
      });
      const text = await r.text();
      const table = /<table[\s\S]*?<\/table>/.exec(text)?.[0] ?? "";
      out[name] = {
        status: r.status,
        bytes: text.length,
        tableRows: [...table.matchAll(/<tr[^>]*>/g)].length,
        hasNavHeader: /Validity Date/.test(text),
      };
    } catch (error) {
      out[name] = { error: String(error).slice(0, 160) };
    }
  }
  return new Response(JSON.stringify({ runtime: "edge", targets: out }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
