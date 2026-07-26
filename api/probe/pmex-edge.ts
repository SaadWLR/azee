/** TEMPORARY reachability probe (Edge) for dportal.pmex.com.pk. Deleted after research. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  try {
    const r = await fetch("https://dportal.pmex.com.pk/MWatchNew/Home/GetJSONObject", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "azee-trade-web/1.0 (pmex probe)" },
      body: "{}",
    });
    const text = await r.text();
    let arr: unknown = null;
    try { arr = JSON.parse(text); } catch { /* keep null */ }
    return new Response(
      JSON.stringify({
        runtime: "edge",
        ok: r.ok,
        status: r.status,
        contentType: r.headers.get("content-type"),
        isArray: Array.isArray(arr),
        count: Array.isArray(arr) ? arr.length : null,
        indicesCount: Array.isArray(arr) ? (arr as { Category?: string }[]).filter((c) => c.Category === "Indices").length : null,
        sample: text.slice(0, 60),
      }),
      { headers: { "content-type": "application/json", "cache-control": "no-store" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ runtime: "edge", error: String(e) }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}
