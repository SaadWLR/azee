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

test("homepage closing section: night-city video, entrance, functional CTA, honest copy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // Track every network request for the closing video file itself.
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
  const video = closing.locator("video");

  // Immediate-load pattern (matches the Hero): the 1080p source is
  // attached on mount — not deferred behind an IntersectionObserver —
  // so it has the full page-dwell time to buffer before the visitor
  // scrolls down. This replaced a deferred 4K load that intermittently
  // left the section blank on real mobile/wifi connections.
  await expect(video).toHaveAttribute(
    "src",
    /videos\.pexels\.com\/video-files\/36244310\/.*1920_1080/,
  );
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);
  expect(
    videoRequests.every((u) => /1920_1080/.test(u)),
    "closing video must load the 1080p variant",
  ).toBe(true);
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
