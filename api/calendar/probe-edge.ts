/** TEMPORARY — PSX calendar POST reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  const today = new Date();
  const to = new Date(today.getTime() + 90 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  let result: unknown;
  try {
    const r = await fetch("https://dps.psx.com.pk/calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "azee-trade-web/1.0 (agm calendar)",
      },
      body: `from=${fmt(today)}&to=${fmt(to)}`,
    });
    const text = await r.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    const data = (parsed as { data?: unknown[] } | null)?.data;
    result = {
      status: r.status,
      isJson: parsed !== null,
      entries: Array.isArray(data) ? data.length : null,
      firstEntry: Array.isArray(data) ? data[0] : text.slice(0, 120),
    };
  } catch (error) {
    result = { error: String(error).slice(0, 150) };
  }
  return new Response(JSON.stringify({ runtime: "edge", calendar: result }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
