import { expect, test } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/*
 * Handler-level tests for /api/news/latest's multi-source resilience.
 *
 * WHY NOT AGAINST THE LIVE ENDPOINT. The behaviour under test is what
 * happens when ONE publisher is unreachable and the other is fine —
 * and there is no way to take Business Recorder down from a test. The
 * other news specs cover the deployed endpoint against whatever the
 * publishers are really serving; this one imports the handler and
 * stubs `fetch`, which is the only way to pin the partial-outage
 * contract deterministically instead of waiting for a real outage.
 *
 * No page is loaded and no viewport matters, so it runs once.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Handler-level tests are viewport-independent; run once on desktop",
  );
});

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDLER = pathToFileURL(
  join(HERE, "..", "..", "api", "news", "latest.ts"),
).href;

const BRECORDER = "https://www.brecorder.com/feeds/business-finance";
const TRIBUNE = "https://tribune.com.pk/feed/business";

/**
 * Synthetic RSS, deliberately fictional and marked "(example)" —
 * matching the newsService dev-fixture rule that no real scraped
 * publisher copy is ever baked into this repo. Each headline carries a
 * STRONG_PAKISTAN token (PSX / SECP / State Bank / PMEX) so it clears
 * the relevance gate on its own, and the four are worded far enough
 * apart that cross-source dedup leaves them distinct.
 */
function rss(items: { title: string; slug: string; date: string }[]): string {
  const blocks = items
    .map(
      ({ title, slug, date }) => `
    <item>
      <title>${title}</title>
      <link>https://example.invalid/${slug}</link>
      <pubDate>${date}</pubDate>
      <description><![CDATA[<p>Example fixture lede for ${slug}.</p>]]></description>
    </item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${blocks}</channel></rss>`;
}

/** Three clearing items — stands in for the larger publisher. */
const BRECORDER_XML = rss([
  {
    title: "PSX benchmark index climbs in morning trade (example)",
    slug: "psx-morning",
    date: "Fri, 28 Aug 2026 09:00:00 +0000",
  },
  {
    title: "SECP notifies new disclosure rules for brokers (example)",
    slug: "secp-disclosure",
    date: "Fri, 28 Aug 2026 08:00:00 +0000",
  },
  {
    title: "State Bank of Pakistan holds the policy rate (example)",
    slug: "sbp-policy-rate",
    date: "Fri, 28 Aug 2026 07:00:00 +0000",
  },
]);

/**
 * ONE clearing item. This is the whole point of the fixture: a single
 * relevant story is a realistic thin yield for the smaller feed (on
 * Aug 28 2026 The Express Tribune's 25 raw items reduced to 2 through
 * the Pakistan-market relevance gate), and under the old combined
 * floor of 3 a feed this thin could not carry the endpoint alone.
 */
const TRIBUNE_XML = rss([
  {
    title: "PMEX gold futures settle higher for the session (example)",
    slug: "pmex-gold",
    date: "Fri, 28 Aug 2026 06:00:00 +0000",
  },
]);

/**
 * Loads a FRESH copy of the handler. The module keeps `lastGood` at
 * module scope (it is the warm-isolate cache), so a single shared
 * import would let one test's success be served as another test's
 * answer — the total-outage case would quietly pass on a cached 200
 * instead of the 503 it is asserting. A distinct query per load
 * defeats the module cache.
 */
let loads = 0;
async function freshHandler(): Promise<() => Promise<Response>> {
  loads += 1;
  const mod = await import(`${HANDLER}?load=${loads}`);
  return mod.default;
}

/** Serves the given feeds; every other URL answers 403, like a block. */
function stubFeeds(available: Record<string, string>): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const xml = available[url];
    if (!xml) return new Response("Forbidden", { status: 403 });
    return new Response(xml, {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }) as typeof fetch;
}

const realFetch = globalThis.fetch;

/*
 * The handler logs every source failure via console.error, and these
 * tests provoke those failures deliberately. Left alone the run prints
 * a wall of stack traces for outcomes the assertions already cover,
 * which reads like a broken suite. Captured instead of silenced, so
 * the logging stays checkable — a source failing quietly would be its
 * own bug — and anything unexpected is still recoverable.
 */
let logged: string[] = [];
const realError = console.error;
test.beforeEach(() => {
  logged = [];
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
});

test.afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

test("serves both publishers when both are reachable", async () => {
  stubFeeds({ [BRECORDER]: BRECORDER_XML, [TRIBUNE]: TRIBUNE_XML });
  const handler = await freshHandler();

  const response = await handler();
  expect(response.status).toBe(200);
  const body = await response.json();

  expect(body.source).toBe("live");
  expect(body.items).toHaveLength(4);
  // Both publishers are represented, attributed to their own names.
  const sources = new Set(body.items.map((i: { source: string }) => i.source));
  expect(sources).toEqual(new Set(["Business Recorder", "The Express Tribune"]));
  // A fully healthy fetch reports nothing wrong.
  expect(logged).toEqual([]);
});

test("a Tribune outage still serves Business Recorder's headlines", async () => {
  stubFeeds({ [BRECORDER]: BRECORDER_XML });
  const handler = await freshHandler();

  const response = await handler();
  expect(response.status).toBe(200);
  const body = await response.json();

  expect(body.source).toBe("live");
  expect(body.items).toHaveLength(3);
  expect(
    body.items.every((i: { source: string }) => i.source === "Business Recorder"),
    "the unreachable publisher contributes nothing rather than a placeholder",
  ).toBe(true);
  // The outage is recorded rather than swallowed.
  expect(logged.join("\n")).toContain("The Express Tribune");
});

/*
 * THE REGRESSION THIS FILE EXISTS FOR.
 *
 * Business Recorder is the feed that has historically been blocked
 * from Vercel (it is why this endpoint runs on the Edge Runtime at
 * all), and it is also the feed with the larger relevant yield. Under
 * the old combined floor of MIN_ITEMS = 3, a BR-only outage left the
 * Tribune's thin-but-real result below the floor, so the endpoint
 * threw and returned 503 — blanking the whole #research section while
 * a publisher was answering perfectly. Fewer headlines is the correct
 * outcome of one publisher going down; no headlines is not.
 */
test("a Business Recorder outage serves the Tribune's headlines, not a 503", async () => {
  stubFeeds({ [TRIBUNE]: TRIBUNE_XML });
  const handler = await freshHandler();

  const response = await handler();
  expect(
    response.status,
    "one reachable publisher must not produce a total outage",
  ).toBe(200);
  const body = await response.json();

  expect(body.source).toBe("live");
  // A single real, attributed headline — served, not suppressed.
  expect(body.items).toHaveLength(1);
  expect(body.items[0].source).toBe("The Express Tribune");
  expect(body.items[0].link).toMatch(/^https?:\/\//);
  // The blocked publisher is still reported, even though the endpoint
  // recovered — a silent partial would hide a real sourcing problem.
  expect(logged.join("\n")).toContain("Business Recorder");
});

test("only a total outage degrades, and it degrades honestly", async () => {
  stubFeeds({});
  const handler = await freshHandler();

  const response = await handler();
  expect(response.status).toBe(503);
  const body = await response.json();

  // The graceful-degradation body Research.tsx's empty state answers.
  expect(body.error).toBe("Market news is temporarily unavailable");
  // Nothing is invented to fill a total outage.
  expect(body.items).toBeUndefined();
  // Both publishers are named in the logs, and the floor is what
  // finally rejected the result.
  const log = logged.join("\n");
  expect(log).toContain("Business Recorder");
  expect(log).toContain("The Express Tribune");
  expect(log).toContain("floor 1");
});
