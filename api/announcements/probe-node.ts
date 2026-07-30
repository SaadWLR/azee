import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY — PSX announcements POST reachability probe (Node). Deleted after decision. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
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
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", announcements: result });
}
