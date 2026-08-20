import { expect, test } from "./fixtures";

/*
 * Desktop-scoped like the other functional specs. The closing section
 * is static, so its behaviour is checked once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Closing CTA is viewport-independent; run once on desktop",
  );
});

test("homepage closing section: real product shot leads, video kept as a supporting panel", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const videoRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/video-files/36244310/"))
      videoRequests.push(req.url());
  });

  await page.goto("/");

  // The closing section is uniquely identified by its own glass class,
  // and sits just before the footer.
  const closing = page.locator("section:has(.closing-glass)");
  await expect(closing).toHaveCount(1);
  await closing.scrollIntoViewIfNeeded();

  /*
   * The night-city footage is KEPT — same 1080p asset, still muted and
   * looping, still fetched. Both halves of this milestone are asserted:
   * that it survives, and that it no longer dominates.
   */
  const video = closing.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute(
    "src",
    /videos\.pexels\.com\/video-files\/36244310\/.*1920_1080/,
  );
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);
  expect(
    videoRequests.some((u) => /3840_2160/.test(u)),
    "the heavy 4K variant must never be fetched",
  ).toBe(false);
  const media = await video.evaluate((v: HTMLVideoElement) => ({
    muted: v.muted,
    loop: v.loop,
  }));
  expect(media.muted).toBe(true);
  expect(media.loop).toBe(true);

  // The real product screenshot is present and is the DOMINANT visual.
  const shot = closing.locator("figure img");
  await expect(shot).toBeVisible();
  await expect(shot).toHaveAttribute("src", /market-watch-preview.*\.jpg/);

  const shotBox = await shot.boundingBox();
  const videoBox = await video.boundingBox();
  expect(shotBox, "product shot renders").not.toBeNull();
  expect(videoBox, "supporting video renders").not.toBeNull();

  const shotArea = shotBox!.width * shotBox!.height;
  const videoArea = videoBox!.width * videoBox!.height;
  expect(
    shotArea,
    `product shot (${Math.round(shotArea)}px²) must dominate the video (${Math.round(videoArea)}px²)`,
  ).toBeGreaterThan(videoArea * 2);

  // The video is no longer a full-bleed background of the section.
  const sectionBox = await closing.boundingBox();
  const coverage = videoArea / (sectionBox!.width * sectionBox!.height);
  expect(
    coverage,
    `video covers ${(coverage * 100).toFixed(1)}% of the section — it must be a supporting panel`,
  ).toBeLessThan(0.25);

  /*
   * Honesty guard: a still of live prices must be labelled as a dated
   * capture, never presented as current, and must point at the live page.
   */
  const caption = closing.locator("figcaption");
  await expect(caption).toContainText(/interface preview captured/i);
  await expect(caption).toContainText(/live at capture/i);
  await expect(
    caption.getByRole("link", { name: /open market watch/i }),
  ).toHaveAttribute("href", "/market-watch");

  // Original closing copy — distinct from Hero and Knowledge Centre.
  await expect(closing.locator("h2")).toContainText("Make your move");

  // Entrance animation resolves to fully visible (seek past the end so
  // the check is deterministic regardless of the animation clock).
  await expect(closing.locator(".closing-fade-up")).not.toHaveCount(0);
  const opacity = await closing
    .locator(".closing-fade-up")
    .first()
    .evaluate((el) => {
      const anim = el.getAnimations()[0];
      if (anim) anim.currentTime = 3000;
      return Number(getComputedStyle(el).opacity);
    });
  expect(opacity).toBeGreaterThan(0.98);

  // The primary CTA (site's existing conversion action) is present.
  await expect(
    closing.getByRole("link", { name: /open a trading account/i }),
  ).toBeVisible();

  // No fabricated performance/marketing claims in the copy.
  const copy = (await closing.innerText()).toLowerCase();
  expect(copy).not.toMatch(
    /#1|\baward|\bguaranteed|\d+%\s*(returns?|profit|gains?)/,
  );

  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("the Hero video is untouched, full-bleed, and its live panel intact", async ({
  page,
}) => {
  /*
   * Explicit guard for what this milestone was told NOT to change: the
   * Hero keeps its rotating-globe footage as a full-bleed treatment,
   * and the live Market Snapshot panel beside it — the real anchor that
   * earns the Hero its video — keeps working.
   */
  await page.goto("/");

  const hero = page.locator("section").first();
  const heroVideo = hero.locator("video").first();
  await expect(heroVideo).toHaveAttribute(
    "src",
    /videos\.pexels\.com\/video-files\/3129957\/.*1920_1080/,
  );
  const media = await heroVideo.evaluate((v: HTMLVideoElement) => ({
    muted: v.muted,
    loop: v.loop,
  }));
  expect(media.muted).toBe(true);
  expect(media.loop).toBe(true);

  // Still full-bleed: it must cover the great majority of its section.
  const vb = await heroVideo.boundingBox();
  const hb = await hero.boundingBox();
  const coverage = (vb!.width * vb!.height) / (hb!.width * hb!.height);
  expect(
    coverage,
    "the Hero video must remain the full-bleed treatment it always was",
  ).toBeGreaterThan(0.8);

  // The live data beside it is untouched and carries a real value.
  await expect(hero).toContainText("KSE-100");
  await expect
    .poll(
      async () =>
        Number(
          (await hero.innerText()).match(/([\d,]{6,})/)?.[1]?.replace(/,/g, "") ??
            0,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(100_000);
});
