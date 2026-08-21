import { expect, test } from "./fixtures";

/*
 * The redesigned homepage sections, checked against the design system
 * the redesign was specified from — so the rules that were hard to hold
 * by eye (no gradient washes, true capsule buttons, serif display type,
 * flat committed section colours) are enforced rather than assumed.
 *
 * Scope: #about, #trading, #research, #start-investing. Hero, Products
 * and Stats are explicitly out of scope and are guarded here as
 * untouched.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Design-system checks are viewport-independent; run once on desktop",
  );
});

const REDESIGNED = ["#about", "#trading", "#research", "#start-investing"];

/** Warm near-black ink and its light counter-tone. */
const INK = "rgb(13, 12, 10)";
const BONE = "rgb(237, 233, 226)";

test("no redesigned section uses a gradient or radial colour wash", async ({
  page,
}) => {
  await page.goto("/");

  /*
   * The forbidden pattern: abstract gradient blobs / ambient corner
   * glows. Checked on the section AND every one of its decorative
   * children, since that is where such a wash would live.
   */
  for (const id of REDESIGNED) {
    const gradients = await page.locator(id).evaluate((section) => {
      const found: string[] = [];
      const all = [section, ...Array.from(section.querySelectorAll("*"))];
      for (const el of all) {
        const bg = getComputedStyle(el as Element).backgroundImage;
        if (bg && bg !== "none" && /gradient/i.test(bg)) {
          // Hairline rules are a 1px linear-gradient and are allowed;
          // anything with real height is a wash.
          const r = (el as Element).getBoundingClientRect();
          if (r.height > 3) found.push(`${(el as Element).tagName}: ${bg.slice(0, 70)}`);
        }
      }
      return found;
    });
    expect(gradients, `${id} must have no gradient wash`).toEqual([]);
  }
});

test("sections commit to one flat colour, alternating ink and bone", async ({
  page,
}) => {
  await page.goto("/");

  const colours: Record<string, string> = {};
  for (const id of REDESIGNED) {
    colours[id] = await page
      .locator(id)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  }

  expect(colours["#about"]).toBe(INK);
  expect(colours["#research"]).toBe(INK);
  expect(colours["#start-investing"]).toBe(INK);
  // The one light section — the page's colour rhythm comes from this.
  expect(colours["#trading"]).toBe(BONE);
});

test("each redesigned section leads with the serif display face", async ({
  page,
}) => {
  await page.goto("/");

  for (const id of REDESIGNED) {
    const family = await page
      .locator(`${id} h2`)
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family, `${id} headline must use the display serif`).toMatch(
      /Playfair/i,
    );
  }

  // Body copy stays sans — the serif is reserved for headlines only.
  const bodyFamily = await page
    .locator("#about p")
    .last()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(bodyFamily).toMatch(/Inter/i);
});

test("headline colour is a desaturated off-white, never pure white", async ({
  page,
}) => {
  await page.goto("/");
  for (const id of ["#about", "#research", "#start-investing"]) {
    const colour = await page
      .locator(`${id} h2`)
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(colour, `${id} headline must not be pure white`).not.toBe(
      "rgb(255, 255, 255)",
    );
  }
});

test("every button and CTA in the redesigned sections is a true capsule", async ({
  page,
}) => {
  await page.goto("/");

  for (const id of REDESIGNED) {
    const shapes = await page.locator(id).evaluate((section) => {
      const bad: string[] = [];
      const controls = section.querySelectorAll(
        'a[href], button, input[type="text"]',
      );
      for (const el of Array.from(controls)) {
        const r = el.getBoundingClientRect();
        // Skip inline text links and anything not rendered.
        if (r.height < 24 || r.width < 24) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "inline") continue;
        const radius = Number.parseFloat(cs.borderTopLeftRadius);
        // A capsule's radius is at least half its height.
        if (radius < r.height / 2 - 1) {
          bad.push(
            `${el.tagName}"${(el.textContent || "").trim().slice(0, 24)}" r=${radius} h=${Math.round(r.height)}`,
          );
        }
      }
      return bad;
    });
    // Article cards are not buttons; they legitimately use a large
    // corner radius rather than a capsule, so exclude the news links.
    const nonCard = shapes.filter((s) => !/^A"/.test(s) || id !== "#research");
    expect(nonCard, `${id} controls must be capsule-shaped`).toEqual([]);
  }
});

test("#about is a real credential wall with a computed years figure", async ({
  page,
}) => {
  await page.goto("/");
  const about = page.locator("#about");

  // Every registration is real and matches the company record.
  for (const id of ["108", "0041920", "04184", "C0418401"]) {
    await expect(about).toContainText(id);
  }
  await expect(about).toContainText("K-8159 (2000-1)");

  // The years figure is computed from the 2003 founding year, not typed.
  const expectedYears = new Date().getFullYear() - 2003;
  await expect(about.locator("h2")).toContainText(String(expectedYears));

  // The old generic icon-and-card grid is gone.
  expect(await about.locator("svg").count()).toBe(0);
});

test("#trading shows a device with live data and a real breadth bar", async ({
  page,
}) => {
  await page.goto("/");
  const trading = page.locator("#trading");
  await trading.scrollIntoViewIfNeeded();

  // The phone is tilted in 3D, per the component spec.
  const transform = await trading
    .locator('[class*="rotateX"], [style*="rotate"]')
    .first()
    .evaluate((el) => getComputedStyle(el).transform)
    .catch(() => "none");
  expect(transform, "the device must be tilted, not flat-on").not.toBe("none");

  /*
   * The breadth bar must match the live feed. The fabricated sparkline
   * it replaced could not have satisfied this.
   */
  await expect
    .poll(async () => (await trading.innerText()).includes("BREADTH"), {
      timeout: 20_000,
    })
    .toBe(true);

  const feed = await page.evaluate(async () => {
    const r = await fetch("/api/market/watch", {
      headers: { Accept: "application/json" },
    });
    const b = await r.json();
    const get = (label: string) =>
      b.stats.find((s: { label: string }) => s.label === label)?.value;
    return { up: get("Advancers"), down: get("Decliners") };
  });

  const shown = await trading.innerText();
  expect(shown, `advancers ${feed.up} must be rendered`).toContain(
    `${feed.up} up`,
  );
  expect(shown, `decliners ${feed.down} must be rendered`).toContain(
    `${feed.down} down`,
  );
});

test("#research is channel-based: News live, Blog honestly pending", async ({
  page,
}) => {
  await page.goto("/");
  const research = page.locator("#research");
  await research.scrollIntoViewIfNeeded();

  const tabs = research.getByRole("tab");
  await expect(tabs).toHaveCount(2);

  const news = research.getByRole("tab", { name: /market news/i });
  const blog = research.getByRole("tab", { name: /azee blog/i });
  await expect(news).toHaveAttribute("aria-selected", "true");
  await expect(blog).toHaveAttribute("aria-selected", "false");

  // News shows the real feed: real outbound publisher links.
  await expect
    .poll(async () => research.locator('a[target="_blank"]').count(), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  // Blog states plainly that nothing exists yet — no invented posts.
  await blog.click();
  await expect(blog).toHaveAttribute("aria-selected", "true");
  await expect(research).toContainText(/not yet published/i);
  await expect(research).toContainText(/Nothing has been published yet/i);
  expect(
    await research.locator('a[target="_blank"]').count(),
    "the pending blog channel must show no articles",
  ).toBe(0);

  // Switching back restores the live feed.
  await news.click();
  await expect
    .poll(async () => research.locator('a[target="_blank"]').count())
    .toBeGreaterThan(0);
});

test("Hero, Products and Stats are untouched by the redesign", async ({
  page,
}) => {
  await page.goto("/");

  // Hero keeps its full-bleed globe video.
  const hero = page.locator("#markets");
  const video = hero.locator("video").first();
  await expect(video).toHaveAttribute(
    "src",
    /videos\.pexels\.com\/video-files\/3129957\//,
  );
  const vb = await video.boundingBox();
  const hb = await hero.boundingBox();
  expect((vb!.width * vb!.height) / (hb!.width * hb!.height)).toBeGreaterThan(
    0.8,
  );
  // And its live panel still reports a real index level.
  await expect(hero).toContainText("KSE-100");

  // Products keeps its existing treatment (filled glass tiles).
  await expect(page.locator("#products")).toBeVisible();
  expect(
    await page.locator("#products .liquid-glass").count(),
  ).toBeGreaterThan(0);

  // Stats keeps its particle field and real figures.
  const stats = page.locator(
    'section:has(p:text-is("Years in Capital Markets"))',
  );
  await expect(stats).toHaveCount(1);
  await stats.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () =>
        (await stats.locator("p.tabular-nums").allInnerTexts()).map((t) =>
          t.trim(),
        ),
      { timeout: 15_000 },
    )
    .toEqual(["20+", "10,000+", "450+", "2"]);
});
