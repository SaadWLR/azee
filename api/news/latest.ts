import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { NewsFeedItem, NewsFeedResponse } from "../../src/types";

/**
 * GET /api/news/latest
 *
 * Live, attributed Pakistani business/market headlines from Business
 * Recorder's business-finance RSS feed. Every title, link, date, and
 * summary comes from the publisher — nothing here is ever written or
 * fabricated by us.
 *
 * The parser is inlined so the function has no relative runtime
 * imports — extensionless ESM imports between compiled files are a
 * known FUNCTION_INVOCATION_FAILED cause on Vercel with
 * "type": "module" projects (see api/market/snapshot.ts). Type-only
 * imports above are erased at compile time and safe.
 */

/*
 * ── Source selection (verified live, Jul 12 2026) ─────────────────
 * investorslounge.com/news/rss: 404 — dead, ruled out.
 * brecorder.com/feeds/markets: valid RSS but dominated by
 *   international wire copy (India, UAE, FTSE, LME…).
 * brecorder.com/feeds/business-finance: valid RSS 2.0, ~30 items,
 *   dominantly Pakistan business/finance (SECP, PSX, SBP, listed
 *   companies, fuel/tax policy) with occasional international
 *   strays — chosen as primary, with the relevance filter below.
 */
const FEED_URL = "https://www.brecorder.com/feeds/business-finance";
const FEED_SOURCE = "Business Recorder";

/**
 * Best-effort relevance filter. Keeps items that look Pakistan-market
 * relevant (regulators, exchanges, currency, Rs amounts, "Pakistan"
 * itself) and drops obvious foreign-market items that share those
 * words (e.g. "Indian rupee"). Known limitations, accepted openly:
 * Pakistani stories that mention only a company name with no keyword
 * or Rs figure are missed, and globally-relevant items (oil prices)
 * are dropped — better to under-show than to mislabel. Not perfect,
 * by design.
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
    throw new Error(`Feed responded ${response.status} for ${FEED_URL}`);
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
    items,
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
     * 5 minutes: Business Recorder publishes a handful of stories per
     * hour, so tick-level freshness is meaningless here — a 300s edge
     * window keeps headlines effectively current while the feed sees
     * at most one fetch per window worldwide.
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
