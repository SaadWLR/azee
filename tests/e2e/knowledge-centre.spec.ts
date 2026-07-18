import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the other functional specs. The Knowledge Centre
 * is static (no live API), so viewport-independent behaviour is checked
 * once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Knowledge Centre tests are viewport-independent; run once on desktop",
  );
});

const MODULE_CARD = '#modules a[href^="/knowledge-centre/"]';

test("landing: moonlit hero renders with video + animated entrance, 8 modules, clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/knowledge-centre");
  await expect(page.locator("h1")).toContainText("Understand the market");

  // Hero video: a real Pexels source, muted + looping autoplay.
  const video = page.locator("section video").first();
  await expect(video).toHaveAttribute("src", /videos\.pexels\.com/);
  const media = await video.evaluate((v: HTMLVideoElement) => ({
    muted: v.muted,
    loop: v.loop,
  }));
  expect(media.muted).toBe(true);
  expect(media.loop).toBe(true);

  // Entrance animation: the stacked elements carry the kc-fade-up keyframe,
  // and it resolves to fully visible. Seeking past the end asserts this
  // deterministically, independent of the animation clock's timing.
  await expect(page.locator(".kc-fade-up")).not.toHaveCount(0);
  const resolvedOpacity = await page
    .locator(".kc-fade-up")
    .first()
    .evaluate((el) => {
      const anim = el.getAnimations()[0];
      if (anim) anim.currentTime = 3000;
      return Number(getComputedStyle(el).opacity);
    });
  expect(resolvedOpacity).toBeGreaterThan(0.98);

  // All eight modules present.
  await expect(page.locator(MODULE_CARD)).toHaveCount(8);

  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("module card opens an honest coming-soon page with zero fabricated content", async ({
  page,
}) => {
  await page.goto("/knowledge-centre");

  const firstCard = page.locator(MODULE_CARD).first();
  const href = await firstCard.getAttribute("href");
  await firstCard.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));

  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText(/content coming soon/i)).toBeVisible();

  // Zero fabricated content: the chapter outline is numbered placeholders
  // only — every row is exactly "<n> Chapter <n> Coming soon", never an
  // invented chapter title or lesson summary.
  const outline = await page.locator("main > section ul li").allInnerTexts();
  expect(outline.length).toBeGreaterThan(0);
  for (const row of outline) {
    expect(row.replace(/\s+/g, " ").trim()).toMatch(
      /^\d+ Chapter \d+ Coming soon$/i,
    );
  }
});

test("module deep-links directly via SPA rewrite; invalid slug degrades gracefully", async ({
  page,
}) => {
  // Direct deep-link into the nested dynamic route — proves the SPA
  // fallback rewrite covers it without config changes.
  await page.goto("/knowledge-centre/technical-analysis");
  await expect(page.locator("h1")).toHaveText("Technical Analysis");
  await expect(page.getByText("7 chapters · ~60 min")).toBeVisible();

  // Unknown slug: a graceful not-found state, no crash, shell intact.
  await page.goto("/knowledge-centre/not-a-real-module");
  await expect(page.locator("h1")).toHaveText("Module not found");
  await expect(page.locator("header nav")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
});
