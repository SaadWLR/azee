import type { NewsFeedItem, NewsFeedResponse } from "../../src/types";

/**
 * GET /api/news/latest  (Edge Runtime)
 *
 * Live, attributed Pakistani business/market headlines combined from
 * multiple publishers' RSS feeds, with direct publisher links. Every
 * title, link, date, and summary comes from the publisher — nothing
 * here is ever written or fabricated by us.
 *
 * WHY EDGE: Business Recorder's Cloudflare tier returns 403 to
 * Vercel's Node (Lambda) egress IPs but 200 from the Edge Runtime
 * (observed via deployed probes, Jul 12 2026). The Express Tribune is
 * reachable from BOTH runtimes (200/200, probed Jul 13 2026), so
 * keeping the whole endpoint on Edge lets both feeds run in one
 * function. Edge has no Node APIs, which is fine: parsing is plain
 * string/regex work, and the module-scope lastGood survives warm
 * isolate reuse.
 *
 * Source history: investorslounge RSS is dead (404); Google News RSS
 * served as an interim aggregator and remains the documented fallback
 * of last resort; Mettis Global has no RSS (soft-404 shell) but its
 * category pages are server-rendered and edge-reachable — a candidate
 * for a future scraped source.
 */
export const config = { runtime: "edge" };

interface NewsSource {
  name: string;
  url: string;
}

/**
 * Both feeds are business-category-scoped RSS 2.0 with the same item
 * shape (title/link/pubDate/description). Adding a third source is a
 * one-line addition here.
 */
const SOURCES: NewsSource[] = [
  {
    name: "Business Recorder",
    url: "https://www.brecorder.com/feeds/business-finance",
  },
  {
    name: "The Express Tribune",
    url: "https://tribune.com.pk/feed/business",
  },
];

/**
 * Best-effort relevance filter. The item must contain genuine
 * market/investing terminology — exchanges and regulators, securities
 * and issuance, corporate results, rates and macro policy, or the
 * commodity/currency prices Pakistani investors track. Deliberately
 * absent: bare "Pakistan", city names, agency names, and any-Rs-amount
 * matching, which let local-interest stories through. Known
 * limitations, accepted openly and shared by every source: some
 * foreign-market items that use these same terms (e.g. a US Fed rate
 * decision, an overseas current-account figure) still pass, since the
 * EXCLUDE list only enumerates a few countries; and relevant stories
 * that name only a company with none of these terms are missed. Not
 * perfect, by design — better to under-show than to pad with noise.
 */
const INCLUDE_PATTERN =
  /\bpsx\b|pakistan stock|\bkse-?\d+\b|\bsecp\b|\bsbp\b|state bank|\bstocks?\b|\bshares?\b|equit(?:y|ies)|\bsukuk\b|\btfc\b|\bbonds?\b|\bipo\b|dividend|earnings|\bprofits?\b|interest rate|policy rate|monetary policy|fiscal (?:policy|deficit|consolidation|reforms?)|inflation|\bcpi\b|\bgdp\b|trade (?:deficit|surplus)|current account|exchange rate|\brupee\b|\bpkr\b|\bgold\b|\bsilver\b|per tola|petrol|\bhsd\b|crude|oil price|\bkibor\b|t-bills?|treasury bill|remittances?|mutual funds?|\bpmex\b|circular debt/i;
const EXCLUDE_PATTERN =
  /india|sri lanka|bangladesh|thailand|\bthai\b|nigeria|kenya/i;

/**
 * Floor on the COMBINED, deduplicated result. Fewer than this means
 * both feeds are down or broken (mirrors watch.ts's MIN_VALID_ROWS) —
 * fall through to lastGood/503 rather than serve a misleading stub.
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
 * The publisher's own lede, verbatim — never composed by us. Business
 * Recorder's <description> is the full article body in HTML (we take
 * its first paragraph); The Express Tribune's is already a short
 * plain-text lede. Both resolve through this single path.
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

function parseItem(block: string, sourceName: string): NewsFeedItem | null {
  const title = textOf(block, "title");
  const link = textOf(block, "link");
  const pubDate = textOf(block, "pubDate");
  if (!title || !link || !pubDate || !link.startsWith("http")) return null;
  const published = new Date(pubDate);
  if (Number.isNaN(published.getTime())) return null;
  return {
    title,
    link,
    source: sourceName,
    publishedAt: published.toISOString(),
    summary: ledeOf(block),
  };
}

function isRelevant(item: NewsFeedItem): boolean {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  return INCLUDE_PATTERN.test(haystack) && !EXCLUDE_PATTERN.test(haystack);
}

/**
 * Fetches and parses one source. Rejects on a network/bot failure so
 * the caller (allSettled) can carry on with the other source; a
 * source that simply has no relevant items resolves to an empty list,
 * which is not a failure.
 */
async function fetchSource(source: NewsSource): Promise<NewsFeedItem[]> {
  const response = await fetch(source.url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "azee-trade-web/1.0 (market news)",
    },
  });
  if (!response.ok) {
    throw new Error(`${source.name} responded ${response.status}`);
  }
  const xml = await response.text();
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  const items: NewsFeedItem[] = [];
  for (const block of blocks) {
    const item = parseItem(block, source.name);
    if (item && isRelevant(item)) items.push(item);
  }
  return items;
}

/*
 * ── Cross-source deduplication ────────────────────────────────────
 * Two outlets covering one story write different headlines (e.g.
 * "SECP enables digital IBAN-based verification" vs "SECP introduces
 * IBAN digital verification"). We compare significant-word sets of
 * the titles (Jaccard similarity, stopwords and sub-3-char tokens
 * dropped) and treat >= 0.5 overlap as the same story. Verified
 * against live data: catches that SECP pair (sim 0.57) while leaving
 * distinct-but-related stories separate (two different-day PSX moves,
 * two different Sukuk angles). Limitations, accepted openly: heavily
 * reworded headlines about one event slip through as two items, and a
 * very generic title pair could in theory over-merge — imperfect
 * dedup is fine here ("that's what news looks like"). When a
 * duplicate is found we keep the first (newest, since the list is
 * date-sorted first) and, if only the dropped copy carried a summary,
 * lift that summary onto the kept item.
 */
const STOPWORDS = new Set(
  "the a an in on of to as for and at by with from over after amid new its is are was were has have will".split(
    " ",
  ),
);

function titleSignature(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const DEDUP_THRESHOLD = 0.5;

function dedupe(items: NewsFeedItem[]): NewsFeedItem[] {
  const kept: { item: NewsFeedItem; sig: Set<string> }[] = [];
  for (const item of items) {
    const sig = titleSignature(item.title);
    const match = kept.find(
      (k) => similarity(sig, k.sig) >= DEDUP_THRESHOLD,
    );
    if (!match) {
      kept.push({ item, sig });
      continue;
    }
    if (!match.item.summary && item.summary) match.item.summary = item.summary;
  }
  return kept.map((k) => k.item);
}

/** Fetches every source in parallel and returns a combined, deduped list. */
async function fetchLatestNews(): Promise<NewsFeedResponse> {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));

  const merged: NewsFeedItem[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      // One source failing must not fail the endpoint — log and go on
      // with whatever the other source returned.
      console.error(`News source "${SOURCES[i].name}" failed:`, result.reason);
    }
  });

  merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const items = dedupe(merged);

  if (items.length < MIN_ITEMS) {
    throw new Error(
      `Combined news yielded only ${items.length} items — all sources may be down or blocked`,
    );
  }

  return {
    items: items.slice(0, MAX_ITEMS),
    asOf: new Date().toISOString(),
    source: "live",
  };
}

/* ── HTTP handler (Web API, Edge Runtime) ─────────────────────── */

/** Survives warm isolate reuse; the graceful answer when feeds are down. */
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
     * current while the feeds see at most one fetch per window
     * worldwide.
     */
    return json(news, 200, "s-maxage=300, stale-while-revalidate=1800");
  } catch (error) {
    console.error("News fetch failed:", error);
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
