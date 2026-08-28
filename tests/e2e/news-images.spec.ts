import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the other functional specs, to manage the
 * suite's known API-volume/rate-limit thin margin. Image behaviour is
 * viewport-independent, so once on desktop is enough.
 *
 * These tests intercept the publisher image requests rather than
 * loading them for real. That is deliberate: the CI/sandbox browser
 * has no route to the publisher CDNs, and even where it did, asserting
 * against live third-party assets (which get renamed or removed) would
 * make the suite flaky for reasons unrelated to our code. Fulfilling /
 * aborting the request ourselves tests exactly our contract — "given
 * the feed gave us an image URL, the UI renders it, and degrades
 * cleanly when the image fails" — deterministically.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "News-image tests are viewport-independent; run once on desktop",
  );
});

const CARD = "#research a[href]";
const CARD_IMG = `${CARD} img`;
/** Both publishers' image CDNs, the only hosts these images come from. */
const PUBLISHER_CDN = /https:\/\/i\.(brecorder\.com|tribune\.com\.pk)\//;

/** A 1x1 PNG — a valid image body to stand in for the publisher's. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("news cards render the publisher image when the CDN serves it", async ({
  page,
}) => {
  // Stand in for the publisher CDN so the <img> actually decodes here.
  let served = 0;
  await page.route(PUBLISHER_CDN, (route) => {
    served += 1;
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TINY_PNG,
    });
  });

  await page.goto("/");
  await page.locator("#research").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator(CARD).count()).toBeGreaterThan(0);

  // The feed's imageUrl becomes a real, decoded <img> — naturalWidth
  // > 0 proves it rendered and displayed, not just that a tag exists.
  const img = page.locator(CARD_IMG).first();
  await expect(img).toBeVisible();
  await expect
    .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  // The src is a genuine publisher CDN URL from the live feed — never
  // fabricated or a placeholder baked into our code.
  expect(await img.getAttribute("src")).toMatch(PUBLISHER_CDN);
  // The image was genuinely requested (not a coincidentally-empty run).
  expect(served).toBeGreaterThan(0);
});

test("shows ≥5 stories by default and 'See more' reveals the rest without fabricating", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#research").scrollIntoViewIfNeeded();

  // Every card is an external <a target="_blank">; the "See more"
  // control is a <button>, so this counts stories only.
  const stories = page.locator('#research a[target="_blank"]');

  /*
   * What the feed actually returned, read first so the expectation
   * tracks reality. A flat ">= 5" floor used to live here and failed
   * on a genuinely thin day (the publishers returned 4), which was the
   * page correctly showing everything it had rather than padding —
   * i.e. the test failed the no-fabrication rule for holding.
   */
  const apiCount = await page.evaluate(async () => {
    const r = await fetch("/api/news/latest", {
      headers: { Accept: "application/json" },
    });
    return (await r.json()).items.length as number;
  });
  expect(apiCount, "the feed returned at least one story").toBeGreaterThan(0);

  /*
   * The default view shows 1 lead + 2 side + 3 grid cards, per
   * Research.tsx's SIDE_HEADLINES and GRID_HEADLINES_DEFAULT — or the
   * whole feed when it is shorter than that.
   *
   * This number is taken from those constants, not inferred: an
   * earlier version of this assertion guessed 5 from the test's own
   * name and passed only because the feed happened to be shorter than
   * both figures that day.
   */
  const DEFAULT_VISIBLE = 1 + 2 + 3;
  const expectedDefault = Math.min(apiCount, DEFAULT_VISIBLE);
  await expect.poll(async () => stories.count()).toBe(expectedDefault);
  const defaultCount = await stories.count();

  // Nothing shown is invented: the visible set never exceeds the feed.
  expect(defaultCount).toBeLessThanOrEqual(apiCount);

  // The live feed returns well over the default set, so the control is
  // present; guard so a rare thin-feed day can't flake the suite.
  const seeMore = page.getByRole("button", { name: /see more/i });
  if (await seeMore.count()) {
    const advertised = Number(
      (await seeMore.textContent())?.match(/\((\d+)\)/)?.[1],
    );
    expect(advertised).toBeGreaterThan(0);

    await seeMore.click();
    // Expanding reveals exactly the advertised count of already-fetched
    // items, and never more than the feed returned.
    await expect
      .poll(async () => stories.count())
      .toBe(defaultCount + advertised);
    expect(await stories.count()).toBeLessThanOrEqual(apiCount);

    // The toggle collapses back to the default set.
    await page.getByRole("button", { name: /show fewer/i }).click();
    await expect.poll(async () => stories.count()).toBe(defaultCount);
  }
});

test("cards degrade gracefully when publisher images fail to load", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  // Force every publisher image to fail at the network layer, standing
  // in for a CDN that renamed or removed an asset.
  let blocked = 0;
  await page.route(PUBLISHER_CDN, (route) => {
    blocked += 1;
    return route.abort();
  });

  await page.goto("/");
  const lead = page.locator(CARD).first();
  await lead.scrollIntoViewIfNeeded();

  // The card's text content is intact regardless of the image.
  await expect(lead.locator("h3")).toBeVisible();

  // We actually exercised a failure (not a no-op because there were no
  // images), and onError then removed the broken image entirely —
  // leaving the clean text-only layout, no lingering broken-image box.
  await expect.poll(async () => blocked).toBeGreaterThan(0);
  await expect.poll(async () => lead.locator("img").count()).toBe(0);

  // A blocked image is a network/console event, not a JS exception —
  // nothing should have thrown.
  expect(pageErrors).toEqual([]);
});

test("a single-story feed fills the row instead of leaving a gap", async ({
  page,
}) => {
  /*
   * A one-item feed became a REACHABLE state when the endpoint's
   * combined floor dropped to 1 (api/news/latest.ts MIN_ITEMS): a
   * single-publisher outage now serves the surviving publisher's
   * headlines instead of 503ing, and on a thin day that can be one
   * story. The lead card's span used to be a fixed 2 of 3 columns, so
   * that state rendered a card with the last third of the row empty —
   * the same "unfinished layout" reading the outage notice exists to
   * prevent, arrived at from the other direction.
   *
   * Served from a synthetic single-item payload rather than a slice of
   * the live feed, so the geometry under test is fixed rather than
   * dependent on what the publishers happen to be running. The item is
   * marked "(example)" for the same reason the dev fixture in
   * newsService is: nothing that could be mistaken for real editorial
   * copy belongs in this repo.
   */
  await page.route("**/api/news/latest*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            title: "PSX benchmark index climbs in morning trade (example)",
            link: "https://example.invalid/psx-morning",
            source: "Business Recorder",
            publishedAt: "2026-08-28T09:00:00.000Z",
            summary: "Example fixture lede for a single-story feed.",
          },
        ],
        asOf: "2026-08-28T09:05:00.000Z",
        source: "live",
      }),
    }),
  );

  await page.goto("/");
  const research = page.locator("#research");
  await research.scrollIntoViewIfNeeded();

  const cards = research.locator('a[target="_blank"]');
  await expect.poll(() => cards.count()).toBe(1);

  /*
   * The lone card reaches the same right edge the grid uses when it is
   * full — i.e. it spans the whole row rather than stopping two-thirds
   * across. Compared against the section's own container so this holds
   * at any viewport width.
   */
  const { cardRight, contentRight } = await research.evaluate((section) => {
    const card = section.querySelector('a[target="_blank"]')!;
    const container = section.querySelector(".max-w-7xl") as HTMLElement;
    const style = getComputedStyle(container);
    return {
      cardRight: card.getBoundingClientRect().right,
      contentRight:
        container.getBoundingClientRect().right -
        Number.parseFloat(style.paddingRight),
    };
  });
  expect(Math.abs(cardRight - contentRight)).toBeLessThan(2);
});

test("#research says the feed is down rather than rendering an empty void", async ({
  page,
}) => {
  /*
   * Stands in for the endpoint's own graceful-degradation body, which
   * production really does serve when both publisher feeds are
   * unreachable from Vercel (observed Aug 28 2026, when Business
   * Recorder briefly stopped answering the Edge Runtime).
   *
   * Before this, the section rendered its heading, tabs and standfirst
   * and then simply stopped — an outage was visually indistinguishable
   * from a broken layout. The rule this locks in is the same one the
   * rest of the site follows (MarketPulseGauge, the PSX lookup): when
   * a feed is down, say so.
   */
  await page.route("**/api/news/latest*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Market news is temporarily unavailable" }),
    }),
  );

  await page.goto("/");
  const research = page.locator("#research");
  await research.scrollIntoViewIfNeeded();

  // The outage is stated in words, and names what did not answer.
  await expect(research).toContainText(/headlines unavailable/i);
  await expect(research).toContainText(/did not respond/i);

  /*
   * Nothing is invented to fill the space: no story cards at all. This
   * also keeps the notice from being mistaken for an article — it
   * carries no outbound link, so `a[target="_blank"]` stays the
   * unambiguous "this is a real story" selector the specs above rely on.
   */
  expect(await research.locator('a[target="_blank"]').count()).toBe(0);

  /*
   * The section occupies real height instead of collapsing to the void
   * this replaces — the reader sees an explanation, not a gap.
   */
  const noticeHeight = await research.evaluate((section) => {
    const notice = [...section.querySelectorAll("div")].find((el) =>
      /headlines unavailable/i.test((el as HTMLElement).innerText ?? ""),
    );
    return notice ? notice.getBoundingClientRect().height : 0;
  });
  expect(noticeHeight).toBeGreaterThan(100);
});
