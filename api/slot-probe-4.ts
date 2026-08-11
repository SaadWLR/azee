import type { VercelRequest, VercelResponse } from "@vercel/node";
/** TEMPORARY headroom probe 4 — deleted immediately after. Node runtime. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ probe: 4, runtime: "node" });
}
