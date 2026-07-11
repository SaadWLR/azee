/**
 * TEMPORARY diagnostic — Edge Runtime reachability probe for news
 * sources (Cloudflare bot scoring differs by egress infrastructure
 * and can only be observed, not predicted). Deleted once the source
 * decision is made.
 */
export const config = { runtime: "edge" };

const TARGETS: Record<string, string> = {
  brecorderFeed: "https://www.brecorder.com/feeds/business-finance",
  mettisEquity: "https://mettisglobal.news/Equity",
  mettisArticle: "https://mettisglobal.news/PSX-Closing-Bell-Staying-Alive-61767",
};

export default async function handler(): Promise<Response> {
  const results: Record<string, unknown> = { runtime: "edge" };
  for (const [name, url] of Object.entries(TARGETS)) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8",
          "User-Agent": "azee-trade-web/1.0 (market news)",
        },
      });
      const body = await response.text();
      results[name] = {
        status: response.status,
        bytes: body.length,
        looksRight:
          name === "brecorderFeed" ? body.includes("<rss") : body.includes("PostList") || body.includes("datePublished"),
      };
    } catch (error) {
      results[name] = { error: String(error).slice(0, 150) };
    }
  }
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
