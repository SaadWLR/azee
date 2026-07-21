/** TEMPORARY probe — Edge runtime reachability of dps.psx.com.pk/indices. Delete after Step 1. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  try {
    const r = await fetch("https://dps.psx.com.pk/indices", {
      headers: {
        Accept: "text/html",
        "User-Agent": "azee-trade-web/1.0 (indices probe)",
      },
    });
    const text = await r.text();
    return new Response(
      JSON.stringify({
        runtime: "edge",
        ok: r.ok,
        status: r.status,
        contentType: r.headers.get("content-type"),
        length: text.length,
        hasKSE100: text.includes("KSE100"),
        hasIndicesTable: text.includes("data-code"),
        sample: text.slice(0, 120),
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ runtime: "edge", error: String(error) }), {
      headers: { "content-type": "application/json" },
    });
  }
}
