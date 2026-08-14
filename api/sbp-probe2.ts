import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * TEMPORARY reachability probe — SBP access points discovered from
 * economyofpakistan.com's published provenance metadata.
 *
 * The earlier probe tested /ecodata/* and the bare easydata host. This
 * one tests the paths that site actually names: /assets/document/*, the
 * archive.sbp.org.pk host, and candidate EasyData API shapes for the
 * real series codes it cites (e.g. TS_GP_BOP_WR_M.WR0010).
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */

const TARGETS = [
  // Paths economyofpakistan.com names as its actual sources
  "https://www.sbp.org.pk/assets/document/forex.pdf",
  "https://www.sbp.org.pk/assets/document/IBF_Arch.xls",
  "https://www.sbp.org.pk/our-operations/monetary-policy",
  "https://archive.sbp.org.pk/ecodata/NetinflowSummary.xls",
  "https://archive.sbp.org.pk/ecodata/dt.xls",
  // Candidate EasyData API shapes for a cited series code
  "https://easydata.sbp.org.pk/api/v1/series/TS_GP_BOP_WR_M.WR0010",
  "https://easydata.sbp.org.pk/api/series/TS_GP_BOP_WR_M.WR0010",
  "https://easydata.sbp.org.pk/apex/rest/series/TS_GP_BOP_WR_M.WR0010",
  "https://easydata.sbp.org.pk/api/data?series=TS_GP_BOP_WR_M.WR0010",
];

const TIMEOUT_MS = 8000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const extra = req.query.url ? [String(req.query.url)] : [];
  const list = req.query.only === "1" && extra.length ? extra : [...TARGETS, ...extra];
  const results = [];
  for (const url of list) {
    const started = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0", Accept: "*/*" },
        signal: ac.signal,
        redirect: "follow",
      });
      const buf = await r.arrayBuffer();
      const b = new Uint8Array(buf.slice(0, 8));
      const head = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 1200));
      results.push({
        url,
        status: r.status,
        ms: Date.now() - started,
        contentType: r.headers.get("content-type"),
        server: r.headers.get("server"),
        bytes: buf.byteLength,
        isPdf: b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
        // XLS (D0CF11E0) and XLSX/zip (PK..)
        isXls: b[0] === 0xd0 && b[1] === 0xcf,
        isZipXlsx: b[0] === 0x50 && b[1] === 0x4b,
        cfBlocked: /Attention Required|Sorry, you have been blocked/i.test(head),
        head: head.replace(/\s+/g, " ").slice(0, 220),
      });
    } catch (e) {
      results.push({
        url,
        ms: Date.now() - started,
        timedOut: ac.signal.aborted,
        error: String(e).slice(0, 160),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ runtime: "node", results });
}
