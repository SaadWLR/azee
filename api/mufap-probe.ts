import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * TEMPORARY reachability probe — MUFAP (mufap.com.pk), NODE runtime.
 *
 * Edge was already confirmed blocked (Cloudflare IP reputation on
 * Vercel's Edge ranges specifically). Node was never tested because the
 * project sat at 12/12 functions; the consolidation refactor freed four
 * slots, so this is that test.
 *
 * DELETE THIS FILE once the result is recorded (probe-and-delete).
 */

const URL_MAIN = "https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=3";
const URL_DIRECTORY = "https://www.mufap.com.pk/FundProfile/FundDirectory";

const TIMEOUT_MS = 15000;

async function probe(url: string) {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "azee-trade-web/1.0",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: ac.signal,
    });
    const html = await r.text();
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    return {
      url,
      status: r.status,
      ms: Date.now() - started,
      contentType: r.headers.get("content-type"),
      server: r.headers.get("server"),
      cfMitigated: r.headers.get("cf-mitigated"),
      bytes: html.length,
      challenge: /Just a moment|challenge-platform|Attention Required/i.test(html),
      trCount: rows.length,
      // Structural fingerprints of the real daily table.
      hasValidityDate: /Validity\s*Date/i.test(html),
      hasNav: /\bNAV\b/i.test(html),
      mentionsOpenEnd: /Open\s*End/i.test(html),
      head: html.replace(/\s+/g, " ").slice(0, 300),
    };
  } catch (e) {
    return {
      url,
      ms: Date.now() - started,
      timedOut: ac.signal.aborted,
      error: String(e).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    runtime: "node",
    results: [await probe(URL_MAIN), await probe(URL_DIRECTORY)],
  });
}
