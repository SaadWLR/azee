import type { NewsFeedItem, NewsFeedResponse } from "../../src/types";

/**
 * GET /api/news/latest  (Edge Runtime)
 *
 * Live, attributed Pakistani business/market headlines from Business
 * Recorder's business-finance RSS feed, with direct publisher links.
 * Every title, link, date, and summary comes from the publisher —
 * nothing here is ever written or fabricated by us.
 *
 * WHY EDGE: Business Recorder's Cloudflare tier returns 403 to
 * Vercel's Node (Lambda) serverless egress IPs, but serves the same
 * request from Vercel's Edge Runtime with 200 (both observed via
 * deployed probes, Jul 12 2026 — bot scoring differs by egress
 * infrastructure). The Edge Runtime has no Node APIs, which is fine:
 * parsing below is plain string/regex work, and the module-scope
 * lastGood survives warm isolate reuse just as it does in Node
 * functions.
 *
 * Source history: investorslounge RSS is dead (404); Google News RSS
 * served as an interim aggregator and remains the documented
 * fallback of last resort; Mettis Global has no RSS (soft-404 shell)
 * but its category pages are server-rendered and edge-reachable — a
 * candidate for a future second source.
 */
export const config = { runtime: "edge" };

const FEED_URL = "https://www.brecorder.com/feeds/business-finance";
const FEED_SOURCE = "Business Recorder";

/**
 * Best-effort relevance filter over a Pakistan-business feed that
 * occasionally carries international wire items. Keeps items that
 * look Pakistan-market relevant (regulators, exchanges, currency,
 * Rs amounts, "Pakistan" itself) and drops foreign-market items that
 * share those words (e.g. "Indian rupee"). Known limitations,
 * accepted openly: Pakistani stories mentioning only a company name
 * with no keyword or Rs figure are missed, and globally-relevant
 * items (oil prices) are dropped — better to under-show than to
 * mislabel. Not perfect, by design.
 */
const INCLUDE_PATTERN =
  /pakistan|\bpsx\b|kse-?100|\bsecp\b|\bsbp\b|state bank|karachi|sukuk|\bfbr\b|ogra|nepra|\bpkr\b|\brs\s?[\d,.]+\s?(bn|billion|mn|million|tr)?|per tola|pak-/i;
const EXCLUDE_PATTERN =
  /india|sri lanka|bangladesh|thailand|\bthai\b|nigeria|kenya/i;

/**
 * A healthy feed carries ~30 items and the filter typically keeps a
 * third or more. Fewer than 3 survivors means the feed or the parse
 * broke (mirrors watch.ts's MIN_VALID_ROWS role) — fail the whole
 * fetch rather than serve a near-empty, misleading list.
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

/**
 * The feed's <description> is the full article body in HTML. The
 * publisher's own first paragraph — their lede, verbatim — serves as
 * the summary; we never compose or rewrite text.
 */
function ledeOf(item: string): string | undefined {
  const description = textOf(item, "description");
  if (!description) return undefined;
  const firstParagraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(description)?.[1];
  const text = (firstParagraph ?? description)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : undefined;
}

function parseItem(block: string): NewsFeedItem | null {
  const title = textOf(block, "title");
  const link = textOf(block, "link");
  const pubDate = textOf(block, "pubDate");
  if (!title || !link || !pubDate || !link.startsWith("http")) return null;
  const published = new Date(pubDate);
  if (Number.isNaN(published.getTime())) return null;
  return {
    title,
    link,
    source: FEED_SOURCE,
    publishedAt: published.toISOString(),
    summary: ledeOf(block),
  };
}

function isRelevant(item: NewsFeedItem): boolean {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  return INCLUDE_PATTERN.test(haystack) && !EXCLUDE_PATTERN.test(haystack);
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
    if (item && isRelevant(item)) items.push(item);
  }
  if (items.length < MIN_ITEMS) {
    throw new Error(
      `News parse yielded only ${items.length} relevant items — feed structure or filter may have broken`,
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

/* ── HTTP handler (Web API, Edge Runtime) ─────────────────────── */

/** Survives warm isolate reuse; the graceful answer when the feed is down. */
let lastGood: NewsFeedResponse | null = null;

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheControl,
    },
  });
}

export default async function handler(): Promise<Response> {
  try {
    const news = await fetchLatestNews();
    lastGood = news;
    /*
     * 5 minutes: business news publishes story-by-story, not
     * tick-by-tick — a 300s edge window keeps headlines effectively
     * current while the feed sees at most one fetch per window
     * worldwide.
     */
    return json(news, 200, "s-maxage=300, stale-while-revalidate=1800");
  } catch (error) {
    console.error("News feed fetch failed:", error);
    if (lastGood) {
      // Serve the last verified headlines, clearly labelled — never
      // fabricate news.
      return json(
        { ...lastGood, stale: true, source: "cache" },
        200,
        "s-maxage=60, stale-while-revalidate=1800",
      );
    }
    return json(
      { error: "Market news is temporarily unavailable" },
      503,
      "no-store",
    );
  }
}
