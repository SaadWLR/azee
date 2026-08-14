/**
 * TEMPORARY reachability probe — SBP (sbp.org.pk), EDGE runtime.
 *
 * Re-confirms the Edge finding from the earlier forex research rather
 * than assuming it still holds. Each fetch is bounded by an
 * AbortController so a hanging origin reports as a timeout instead of
 * killing the whole function.
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */
export const config = { runtime: "edge" };

const TARGETS = [
  "https://www.sbp.org.pk/robots.txt",
  "https://www.sbp.org.pk/",
  "https://easydata.sbp.org.pk/",
];

const TIMEOUT_MS = 6000;

export default async function handler(): Promise<Response> {
  const results = [];
  for (const url of TARGETS) {
    const started = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "azee-trade-web/1.0" },
        signal: ac.signal,
      });
      const body = await r.text();
      results.push({
        url,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        server: r.headers.get("server"),
        cfRay: r.headers.get("cf-ray"),
        bytes: body.length,
        denied: /Access Denied|Signature ID/i.test(body),
        head: body.replace(/\s+/g, " ").slice(0, 300),
      });
    } catch (e) {
      results.push({
        url,
        ok: false,
        ms: Date.now() - started,
        timedOut: ac.signal.aborted,
        error: String(e).slice(0, 200),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  return new Response(JSON.stringify({ runtime: "edge", results }, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
