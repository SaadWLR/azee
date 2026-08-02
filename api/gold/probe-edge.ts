/** TEMPORARY — local gold-rate source reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

const TARGETS: Record<string, string> = {
  pakgold: "https://pakgold.net/",
  goldPk: "https://www.gold.pk/",
  khita: "https://khita.com.pk/gold-rate-in-pakistan/",
};

export default async function handler(): Promise<Response> {
  const out: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(TARGETS)) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0 (gold probe)" },
      });
      const text = await r.text();
      out[name] = {
        status: r.status,
        bytes: text.length,
        hasTolaFigure: /4[0-9]{2},[0-9]{3}/.test(text),
      };
    } catch (error) {
      out[name] = { error: String(error).slice(0, 150) };
    }
  }
  return new Response(JSON.stringify({ runtime: "edge", targets: out }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
