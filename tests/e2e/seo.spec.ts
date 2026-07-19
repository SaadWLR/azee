import { expect, test } from "./fixtures";

/*
 * Desktop-scoped: per-route metadata and the sitemap are viewport-
 * independent, so once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "SEO metadata checks run once on desktop",
  );
});

/** One representative route per kind, with its exact expected title. */
const ROUTE_TITLES: [path: string, title: RegExp][] = [
  ["/", /^AZEE Trade — Invest in the Pakistan Stock Exchange$/],
  ["/market-watch", /^Market Watch — Live PSX Stock Prices \| AZEE Trade$/],
  [
    "/corporate-calendar",
    /^Corporate Calendar — PSX AGM\/EOGM Meetings & Payouts \| AZEE Trade$/,
  ],
  ["/knowledge-centre", /^Knowledge Centre — Investor Education \| AZEE Trade$/],
  [
    "/knowledge-centre/stock-market-basics",
    /^Stock Market Basics \| AZEE Knowledge Centre$/,
  ],
];

test("each route sets its own distinct title and meta description", async ({
  page,
}) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const [path, titleRe] of ROUTE_TITLES) {
    await page.goto(path);
    // Title is set by usePageMeta's effect after mount — poll for it.
    await expect.poll(async () => page.title()).toMatch(titleRe);

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description, `meta description on ${path}`).toBeTruthy();
    // og:description mirrors the meta description.
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(ogDescription).toBe(description);

    titles.add(await page.title());
    descriptions.add(description!);
  }

  // No two routes share a title or description.
  expect(titles.size).toBe(ROUTE_TITLES.length);
  expect(descriptions.size).toBe(ROUTE_TITLES.length);
});

test("sitemap.xml is valid and lists every real route, module slugs included", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/xml/);

  const body = await response.text();
  const expectedPaths = [
    "/",
    "/market-watch",
    "/corporate-calendar",
    "/knowledge-centre",
    "/knowledge-centre/stock-market-basics",
    "/knowledge-centre/fundamental-analysis",
    "/knowledge-centre/technical-analysis",
    "/knowledge-centre/investment-strategies",
    "/knowledge-centre/commodities-market",
    "/knowledge-centre/currency-market",
    "/knowledge-centre/mutual-funds",
    "/knowledge-centre/intraday-futures-trading",
  ];
  for (const path of expectedPaths) {
    // The trailing "<" ensures an exact <loc> match, not a prefix.
    expect(body).toContain(`<loc>https://azee.vercel.app${path}</loc>`);
  }
  // 12 URLs total — the four top routes plus the eight modules.
  expect(body.match(/<loc>/g)?.length).toBe(12);
});
