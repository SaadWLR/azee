/** TEMPORARY — Tribune reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
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
  return new Response(JSON.stringify({ runtime: "edge", tribune: result }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
