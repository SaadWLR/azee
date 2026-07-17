/** TEMPORARY — PSX payouts POST reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  let result: unknown;
  try {
    const r = await fetch("https://dps.psx.com.pk/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "azee-trade-web/1.0 (payouts)",
      },
      body: "start=0&length=50",
    });
    const text = await r.text();
    result = {
      status: r.status,
      bytes: text.length,
      rows: (text.match(/<tr[\s>]/g) ?? []).length,
      totalEntries: /of (\d+) entries/.exec(text)?.[1] ?? null,
      looksRight: text.includes("<table") || text.includes("announcementsResults"),
      head: text.slice(0, 100),
    };
  } catch (error) {
    result = { error: String(error).slice(0, 150) };
  }
  return new Response(JSON.stringify({ runtime: "edge", payouts: result }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
