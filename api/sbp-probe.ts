import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * TEMPORARY reachability probe — SBP (sbp.org.pk).
 *
 * Node runtime. Uses one of the four slots freed by the consolidation
 * refactor, so this can finally be tested directly rather than deferred.
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */

const TARGETS = [
  "https://www.sbp.org.pk/robots.txt",
  "https://easydata.sbp.org.pk/robots.txt",
  "https://www.sbp.org.pk/",
  // Policy rate / monetary policy
  "https://www.sbp.org.pk/m_policy/index.asp",
  // Statistics hub + the weekly reserves and remittances landing pages
  "https://www.sbp.org.pk/ecodata/index2.asp",
  "https://www.sbp.org.pk/ecodata/forex.pdf",
  "https://www.sbp.org.pk/ecodata/Homeremitt.pdf",
  // SBP's structured statistics portal — the likeliest real API
  "https://easydata.sbp.org.pk/",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const extra = req.query.url ? [String(req.query.url)] : [];
  const results = [];
  for (const url of [...TARGETS, ...extra]) {
    const started = Date.now();
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "azee-trade-web/1.0",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
        redirect: "follow",
      });
      const buf = await r.arrayBuffer();
      const head = new TextDecoder("utf-8", { fatal: false }).decode(
        buf.slice(0, 3000),
      );
      results.push({
        url,
        finalUrl: r.url,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        contentType: r.headers.get("content-type"),
        server: r.headers.get("server"),
        bytes: buf.byteLength,
        isPdf: new Uint8Array(buf.slice(0, 4)).every(
          (b, i) => b === [0x25, 0x50, 0x44, 0x46][i],
        ),
        denied: /Access Denied|Signature ID/i.test(head),
        head: head.replace(/\s+/g, " ").slice(0, 900),
      });
    } catch (e) {
      results.push({ url, ok: false, ms: Date.now() - started, error: String(e) });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", results });
}
