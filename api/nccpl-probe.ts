/**
 * TEMPORARY reachability probe — NCCPL (nccpl.com.pk) FIPI/LIPI.
 *
 * Edge runtime deliberately: the project sits at Vercel Hobby's 12/12
 * Node function ceiling, so a Node probe has no slot. Edge is not
 * counted against that ceiling, so this tests what can be tested
 * without displacing a live endpoint.
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */
export const config = { runtime: "edge" };

const TARGETS = [
  "https://www.nccpl.com.pk/en/market-information/fipi-lipi/fipi",
  "https://www.nccpl.com.pk/en/market-information/fipi-lipi/lipi",
  "https://www.nccpl.com.pk/robots.txt",
];

export default async function handler(): Promise<Response> {
  const results = [];
  for (const url of TARGETS) {
    const started = Date.now();
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "azee-trade-web/1.0",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      });
      const body = await r.text();
      results.push({
        url,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        server: r.headers.get("server"),
        cfMitigated: r.headers.get("cf-mitigated"),
        cfRay: r.headers.get("cf-ray"),
        bytes: body.length,
        // Fingerprints that tell a challenge apart from real content.
        challenge: /Just a moment|challenge-platform|cf-chl/i.test(body),
        hasDataTable: /id="tbl"/.test(body),
        snippet: body.slice(0, 200).replace(/\s+/g, " "),
      });
    } catch (e) {
      results.push({ url, ok: false, ms: Date.now() - started, error: String(e) });
    }
  }
  return new Response(JSON.stringify({ runtime: "edge", results }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
