import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY — PSX payouts POST reachability probe (Node). Deleted after decision. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
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
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", payouts: result });
}
