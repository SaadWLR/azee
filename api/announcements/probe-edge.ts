/** TEMPORARY — PSX announcements POST reachability probe (Edge). Deleted after decision. */
export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  let result: unknown;
  try {
    const r = await fetch("https://dps.psx.com.pk/announcements", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "azee-trade-web/1.0 (announcements probe)",
      },
      body: "type=C&symbol=&query=&count=5&offset=0&date_from=&date_to=&page=annc",
    });
    const text = await r.text();
    result = {
      status: r.status,
      bytes: text.length,
      hasAnnouncementsTable: text.includes("announcementsTable"),
      snippet: text.slice(0, 500),
    };
  } catch (error) {
    result = { error: String(error).slice(0, 200) };
  }
  return new Response(
    JSON.stringify({ runtime: "edge", announcements: result }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
