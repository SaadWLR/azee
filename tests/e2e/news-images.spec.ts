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
  await expect.poll(async () => stories.count()).toBeGreaterThanOrEqual(5);
  const defaultCount = await stories.count();

  // Nothing shown is invented: the visible set never exceeds what the
  // API actually returned.
  const apiCount = await page.evaluate(async () => {
    const r = await fetch("/api/news/latest", {
      headers: { Accept: "application/json" },
    });
    return (await r.json()).items.length as number;
  });
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
