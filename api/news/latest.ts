import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { NewsFeedItem, NewsFeedResponse } from "../../src/types";

/**
 * GET /api/news/latest
 *
 * Live, attributed Pakistani market headlines. Every title, link,
 * date, and publisher attribution comes from the feed — nothing here
 * is ever written or fabricated by us.
 *
 * The parser is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects (see api/market/snapshot.ts). Type-only
 * imports above are erased at compile time and safe.
 */

/*
 * ── Source selection (verified live, Jul 12 2026) ─────────────────
 * investorslounge.com/news/rss — 404, dead.
 * brecorder.com/feeds/business-finance — excellent Pakistan-centric
 *   content and parsed cleanly, BUT its Cloudflare tier returns 403
 *   to Vercel's datacenter egress IPs even with a browser UA
 *   (confirmed via deployed diagnostics). We do not circumvent bot
 *   protection, so it is unusable from serverless.
 * Google News RSS (query-scoped) — chosen primary: served by Google
 *   (reliable from datacenter IPs), and the PSX/KSE-100/SECP query
 *   makes every item market-relevant by construction. Each item
 *   carries the original publisher in <source>, which we surface as
 *   the attribution. Trade-offs, documented honestly: links are
 *   news.google.com redirects to the publisher (attribution intact,
 *   one hop for the reader), and the feed's <description> is a
 *   link-list snippet rather than a genuine publisher excerpt — so
 *   items carry NO summary field; we will not present aggregator
 *   boilerplate (or our own words) as publisher prose.
 */
const FEED_URL =
  "https://news.google.com/rss/search?q=%22Pakistan%20Stock%20Exchange%22%20OR%20KSE-100%20OR%20PSX%20OR%20SECP&hl=en-PK&gl=PK&ceid=PK:en";

/**
 * A healthy query feed carries ~100 items. Fewer than 3 parsed items
 * means the feed or the parse broke (mirrors watch.ts's
 * MIN_VALID_ROWS role) — fail the whole fetch rather than serve a
 * near-empty, misleading list.
 */
const MIN_ITEMS = 3;

/** How many newest items the endpoint returns. */
const MAX_ITEMS = 20;

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function textOf(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!match) return null;
  return decodeEntities(
    match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim(),
  );
}

function parseItem(block: string): NewsFeedItem | null {
  let title = textOf(block, "title");
  const link = textOf(block, "link");
  const pubDate = textOf(block, "pubDate");
  const source = textOf(block, "source");
  if (!title || !link || !pubDate || !source || !link.startsWith("http")) {
    return null;
  }
  const published = new Date(pubDate);
  if (Number.isNaN(published.getTime())) return null;

  // Google News suffixes titles with " - Publisher"; the publisher is
  // carried separately in <source>, so strip the duplicate suffix.
  // The headline text itself remains the publisher's, verbatim.
  const suffix = ` - ${source}`;
  if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();

  // Some registered publisher names carry stray leading punctuation
  // (e.g. "| Associated Press Of Pakistan") — trim formatting only.
  const cleanSource = source.replace(/^[|\s]+/, "").replace(/\s+/g, " ").trim();
  if (!cleanSource) return null;

  return {
    title,
    link,
    source: cleanSource,
    publishedAt: published.toISOString(),
  };
}

/** Fetches and normalizes the live feed; raw XML never leaves here. */
async function fetchLatestNews(): Promise<NewsFeedResponse> {
  const response = await fetch(FEED_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "azee-trade-web/1.0 (market news)",
    },
  });
  if (!response.ok) {
    throw new Error(`Feed responded ${response.status}`);
  }
  const xml = await response.text();

  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  const items: NewsFeedItem[] = [];
  for (const block of blocks) {
    const item = parseItem(block);
    if (item) items.push(item);
  }
  if (items.length < MIN_ITEMS) {
    throw new Error(
      `News parse yielded only ${items.length} items — feed structure may have changed`,
    );
  }

  items.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return {
    items: items.slice(0, MAX_ITEMS),
    asOf: new Date().toISOString(),
    source: "live",
  };
}

/* ── HTTP handler ──────────────────────────────────────────────── */

/** Survives warm invocations; the graceful answer when the feed is down. */
let lastGood: NewsFeedResponse | null = null;

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const news = await fetchLatestNews();
    lastGood = news;
    /*
     * 5 minutes: business news publishes story-by-story, not
     * tick-by-tick — a 300s edge window keeps headlines effectively
     * current while the feed sees at most one fetch per window
     * worldwide.
     */
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.status(200).json(news);
  } catch (error) {
    console.error("News feed fetch failed:", error);
    if (lastGood) {
      // Serve the last verified headlines, clearly labelled — never
      // fabricate news.
      res.setHeader(
        "Cache-Control",
        "s-maxage=60, stale-while-revalidate=1800",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Market news is temporarily unavailable",
    });
  }
}

export { fetchLatestNews };
