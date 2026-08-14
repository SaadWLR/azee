/**
 * TEMPORARY reachability probe — SBP (sbp.org.pk), EDGE runtime.
 *
 * Re-confirms the Edge-403 finding from the earlier forex research
 * rather than assuming it still holds. Edge is not counted against the
 * Hobby function ceiling.
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */
export const config = { runtime: "edge" };

const TARGETS = [
  "https://www.sbp.org.pk/robots.txt",
  "https://www.sbp.org.pk/",
  "https://easydata.sbp.org.pk/",
];

export default async function handler(): Promise<Response> {
  const results = [];
  for (const url of TARGETS) {
    const started = Date.now();
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0" },
      });
      const body = await r.text();
      results.push({
        url,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        server: r.headers.get("server"),
        bytes: body.length,
        denied: /Access Denied|Signature ID/i.test(body),
        head: body.replace(/\s+/g, " ").slice(0, 400),
      });
    } catch (e) {
      results.push({ url, ok: false, ms: Date.now() - started, error: String(e) });
    }
  }
  return new Response(JSON.stringify({ runtime: "edge", results }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
