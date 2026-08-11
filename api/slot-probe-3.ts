import type { VercelRequest, VercelResponse } from "@vercel/node";
/** TEMPORARY headroom probe 3 — deleted immediately after. Node runtime. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ probe: 3, runtime: "node" });
}
