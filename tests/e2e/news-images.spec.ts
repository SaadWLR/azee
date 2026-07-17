import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the other functional specs, to manage the
 * suite's known API-volume/rate-limit thin margin. Image behaviour is
 * viewport-independent, so once on desktop is enough.
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

test("publisher images render on news cards from live feed data", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#research").scrollIntoViewIfNeeded();

  // Headlines load asynchronously; wait for the cards to populate.
  await expect
    .poll(async () => page.locator(CARD).count())
    .toBeGreaterThan(0);

  // At least one card shows a real, fully-decoded publisher image —
  // naturalWidth > 0 proves the hotlink actually loaded, not just that
  // an <img> tag exists in the DOM.
  const img = page.locator(CARD_IMG).first();
  await expect(img).toBeVisible();
  await expect
    .poll(async () =>
      img.evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);

  // The src is a genuine publisher CDN URL — never fabricated or a
  // placeholder baked into our code.
  expect(await img.getAttribute("src")).toMatch(PUBLISHER_CDN);
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
  expect(blocked).toBeGreaterThan(0);
  await expect.poll(async () => lead.locator("img").count()).toBe(0);

  // A blocked image is a network/console event, not a JS exception —
  // nothing should have thrown.
  expect(pageErrors).toEqual([]);
});
