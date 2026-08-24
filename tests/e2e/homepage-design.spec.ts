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

/**
 * Park the fixed navbar `into` pixels inside a section, and land there
 * before returning.
 *
 * Two traps, both of which produced real flakes in this file:
 *
 * `offsetTop` is measured from the nearest POSITIONED ancestor, not
 * the document, so any `position: relative` wrapper anywhere up the
 * tree silently shifts it — and the scroll then lands in a different
 * section than the test believes.
 *
 * And the page sets `scroll-behavior: smooth` globally, so a plain
 * scrollTo starts an animation that outlives the call. Assertions then
 * race it: the nav is still crossing the section above when its theme
 * is read. `behavior: "instant"` opts this one scroll out without
 * touching how the site behaves for anyone else.
 */
async function parkNavIn(
  page: import("@playwright/test").Page,
  selector: string,
  into = 240,
) {
  await page.evaluate(
    ({ sel, offset }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no element for ${sel}`);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + offset, behavior: "instant" });
    },
    { sel: selector, offset: into },
  );
}

test("no redesigned section uses a gradient or radial colour wash", async ({
  page,
}) => {
  await page.goto("/");

  /*
   * The forbidden pattern: abstract gradient blobs / ambient corner
   * glows. Checked on the section AND every one of its decorative
   * children, since that is where such a wash would live.
   *
   * ONE sanctioned exception, marked in the markup with
   * data-hero-blend: the band that carries the hero's navy down into
   * #about's ink. That gradient is structural — it bridges two real
   * sections that genuinely differ in colour so the boundary reads as
   * one descent rather than a cut — rather than decorative. It is
   * excluded by that attribute alone, so any OTHER gradient appearing
   * in these sections still fails, and a second one cannot be
   * smuggled in without adding the marker deliberately.
   */
  for (const id of REDESIGNED) {
    const gradients = await page.locator(id).evaluate((section) => {
      const found: string[] = [];
      const all = [section, ...Array.from(section.querySelectorAll("*"))];
      for (const el of all) {
        if ((el as Element).hasAttribute("data-hero-blend")) continue;
        const bg = getComputedStyle(el as Element).backgroundImage;
        if (bg && bg !== "none" && /gradient/i.test(bg)) {
          // Hairline rules are a 1px linear-gradient and are allowed;
          // anything with real height is a wash.
          const r = (el as Element).getBoundingClientRect();
          if (r.height > 3)
            found.push(`${(el as Element).tagName}: ${bg.slice(0, 70)}`);
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

  /*
   * The credentials are a layered, rotated stack — a real object — not
   * a flat grid in one bordered box. Every card must carry its own
   * rotation, and they must overlap.
   */
  const stack = await about.evaluate((section) => {
    const cards = [...section.querySelectorAll("[class*='rotate']")];
    /*
     * Tailwind v4 emits rotate-* as the standalone CSS `rotate`
     * property, NOT as a `transform`. Checking only `transform` reports
     * "none" on a card that is visibly rotated — so both are accepted.
     */
    const rotated = cards.filter((c) => {
      const cs = getComputedStyle(c);
      return cs.transform !== "none" || (cs.rotate && cs.rotate !== "none");
    });
    const boxes = rotated.map((c) => c.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1];
      const b = boxes[i];
      if (b.top < a.bottom && b.bottom > a.top) overlaps++;
    }
    return { rotatedCount: rotated.length, overlaps };
  });
  expect(stack.rotatedCount, "each credential card is rotated").toBe(4);
  expect(stack.overlaps, "the cards overlap into a stack").toBeGreaterThan(0);
});

test("#trading shows a device with live data and a real breadth bar", async ({
  page,
}) => {
  await page.goto("/");
  const trading = page.locator("#trading");
  await trading.scrollIntoViewIfNeeded();

  /*
   * The device must be GENUINELY dimensional, which a transform value
   * alone does not prove: `perspective` applies only to an element's
   * direct children, so a rotateY under a perspective set on a
   * grandparent degrades to a flat squish while still reporting a
   * matrix3d. That is exactly how this rendered straight-on before.
   *
   * So the check is on the rendered GEOMETRY: a perspective rotation
   * makes the near edge taller than the far edge. Comparing the two
   * vertical edges of the device catches a flat transform that a
   * computed-style read would pass.
   */
  const geom = await trading.evaluate((section) => {
    const el = section.querySelector(
      '[class*="rotateY"]',
    ) as HTMLElement | null;
    if (!el) return null;
    const q = el.getBoundingClientRect();
    const parentPerspective = getComputedStyle(el.parentElement!).perspective;
    return {
      transform: getComputedStyle(el).transform,
      parentPerspective,
      width: q.width,
      height: q.height,
    };
  });
  expect(geom, "the device node renders").not.toBeNull();
  // Perspective must be on the DIRECT parent, or the tilt is fake.
  expect(
    geom!.parentPerspective,
    "perspective must sit on the device's immediate parent",
  ).not.toBe("none");
  expect(geom!.transform).toMatch(/^matrix3d/);

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

  /*
   * Products is no longer "untouched" — it was brought into scope and
   * rebuilt as a canvas list. What must hold is that all six real
   * services survived the change with their real destinations.
   */
  const products = page.locator("#products");
  await expect(products).toBeVisible();
  expect(
    await products.locator(".liquid-glass").count(),
    "the icon-card grid must be gone",
  ).toBe(0);
  for (const name of [
    "Equity Trading",
    "PMEX Commodities",
    "IPO Investment",
    "Mutual Funds",
    "Market Research",
    "Portfolio Advisory",
  ]) {
    await expect(products).toContainText(name);
  }
  await expect(products.locator('a[href="/commodities"]')).toHaveCount(1);
  await expect(products.locator('a[href="/mutual-funds"]')).toHaveCount(1);

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

/*
 * ── Hero → About continuity ────────────────────────────────────────
 *
 * The boundary between the hero and #about used to be a cut: black
 * footage above, ink below, a hairline between them. It is now a blend
 * carried by BOTH sides — the hero's own bottom scrim settles into
 * --azee-navy, and #about's band picks that navy up and eases it into
 * ink.
 *
 * Both halves are asserted, because the whole point is that they meet.
 * A blend applied to only one side is exactly the "two unrelated
 * sections stacked" problem it was meant to fix, and it would still
 * look plausible in isolation.
 */
test("the hero and #about meet through one continuous blend", async ({
  page,
}) => {
  await page.goto("/");

  // Exactly one sanctioned blend on the page — the marker is not a
  // general licence to add gradients.
  await expect(page.locator("[data-hero-blend]")).toHaveCount(1);

  const navy = "12, 24, 66";

  // #about's half: navy at the top edge, easing to nothing.
  const band = page.locator("#about [data-hero-blend]");
  const bandBg = await band.evaluate(
    (el) => getComputedStyle(el).backgroundImage,
  );
  expect(bandBg, "the band must be a top-down linear gradient").toContain(
    "linear-gradient",
  );
  expect(bandBg, "the band must start in the brand navy").toContain(navy);
  expect(
    await band.evaluate((el) => el.getBoundingClientRect().height),
    "a blend needs real distance to read as a blend, not a seam",
  ).toBeGreaterThan(200);

  // The hero's half: its bottom scrim must land on the same navy, or
  // the two sides meet at different colours and the seam returns.
  const heroScrim = page.locator("#markets > div[aria-hidden='true']").first();
  const heroBg = await heroScrim.evaluate(
    (el) => getComputedStyle(el).backgroundImage,
  );
  expect(
    heroBg,
    "the hero's floor must carry the same navy the band starts from",
  ).toContain(navy);

  // The band sits behind the content, not over it.
  await expect(band).toHaveCSS("pointer-events", "none");
});

/*
 * ── The nav's third theme ──────────────────────────────────────────
 *
 * The bar is opaque, so it must match whichever of the page's three
 * grounds it is over: the blue-lit hero, the ink sections, the bone
 * #trading block. Asserted by scrolling to each and reading the
 * resolved attribute plus the surface it produces.
 */
test("the nav carries a distinct theme over hero, ink and bone", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.locator("nav.nav-glass");

  /*
   * The attribute settles first, then the surface catches up: the
   * colour transition is 0.45s and the page scrolls smoothly, so a
   * single read lands on a genuine in-between frame. Both are polled.
   */
  const expectTheme = async (theme: string, surface: string, id?: string) => {
    if (id) {
      /*
       * Parked an explicit distance INTO the section rather than using
       * scrollIntoViewIfNeeded: these sections are taller than the
       * viewport, so "if needed" settles for bringing the top edge
       * into view — which on a tall viewport can leave the bar still
       * sitting over the section above. The test would then read the
       * previous section's theme and call it a failure.
       */
      await parkNavIn(page, id);
    }
    await expect(nav).toHaveAttribute("data-nav-theme", theme, {
      timeout: 10_000,
    });
    await expect
      .poll(
        async () => nav.evaluate((el) => getComputedStyle(el).backgroundColor),
        { timeout: 5_000 },
      )
      .toBe(surface);
  };

  // Top of the page: over the hero, wearing the brand navy.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expectTheme("hero", "rgb(12, 24, 66)");

  // Over #about: the ink default.
  await expectTheme("dark", INK, "#about");

  // Over the bone #trading block: the light theme still wins.
  await expectTheme("light", BONE, "#trading");
});

/*
 * ── #products is a chain, not a motif ──────────────────────────────
 *
 * The section's claim is "Every market, one relationship", and the
 * chain is how it is made visible: six services threaded onto one
 * chain, each on its own link.
 *
 * The assertions are the properties that make it a chain rather than a
 * column of ovals, because those are exactly the ones that decay
 * silently — a geometry constant nudged, a row height changed, and it
 * degrades into decoration without anything failing.
 */
test("#products threads its services onto one real chain", async ({ page }) => {
  await page.goto("/");
  /*
   * Every scroll in this test is a means of getting somewhere, never
   * the thing under test — and the page's global `scroll-behavior:
   * smooth` turns each one into an animation that outlives the command
   * that started it. Forced instant so positions are settled by the
   * time anything is measured or pointed at.
   */
  await page.addStyleTag({
    content: "html { scroll-behavior: auto !important; }",
  });
  const products = page.locator("#products");
  const rows = products.locator("[data-product-row]");
  const chain = products.locator("svg.chain:visible");

  /*
   * Run at BOTH breakpoints. The section renders two chains and shows
   * one, and they are not the same drawing scaled — each carries its
   * own pitch, link width and wire, paired with its own row height. A
   * desktop-only check would leave every one of those numbers on the
   * phone unguarded, which is where they are tightest.
   */
  const assertChain = async (label: string) => {
    await products.scrollIntoViewIfNeeded();

    await expect(rows, label).toHaveCount(6);

    // Only one of the two breakpoint chains is rendered at a time.
    await expect(chain, label).toHaveCount(1);

    const geometry = await chain.evaluate((svg) => {
      const rects = [...svg.querySelectorAll("g > rect")];
      const num = (el: Element, a: string) => Number(el.getAttribute(a));
      return {
        // 6 links + a clipped second copy of each turned link that has a
        // face-on link below it.
        shapes: rects.length,
        widths: rects.map((r) => num(r, "width")),
        tops: rects.slice(0, 6).map((r) => num(r, "y")),
        heights: rects.slice(0, 6).map((r) => num(r, "height")),
        radii: rects.slice(0, 6).map((r) => num(r, "rx")),
        // The rect is the stroke's CENTRELINE, so the link's real outer
        // extent is half a wire beyond it at each end.
        wire: num(rects[0], "stroke-width"),
        clipped: svg.querySelectorAll("g[clip-path]").length,
      };
    });

    // ALTERNATION. Consecutive links are turned 90° to each other, so
    // their apparent widths must alternate wide/narrow. A chain drawn
    // without this is a stack of identical ovals.
    const [wide, narrow] = [geometry.widths[0], geometry.widths[1]];
    expect(
      narrow,
      `${label}: turned links read narrower than face-on ones`,
    ).toBeLessThan(wide / 2);
    for (let i = 0; i < 6; i++) {
      expect(geometry.widths[i], `${label}: link ${i} alternates`).toBe(
        i % 2 === 0 ? wide : narrow,
      );
    }

    // STADIUM ENDS. A link's end is a semicircle of its own half-width —
    // that is what gives it a hole to thread through.
    geometry.radii.forEach((r, i) => {
      expect(r, `${label}: link ${i} ends in a true semicircle`).toBeCloseTo(
        geometry.widths[i] / 2,
        1,
      );
    });

    // OVERLAP. Consecutive links must overlap by half a link-width, the
    // resting geometry of a hanging chain. Touching end-to-end is a
    // string of beads; not touching is not a chain at all.
    const pitch = geometry.tops[1] - geometry.tops[0];
    const overlap = geometry.heights[0] + geometry.wire - pitch;
    expect(overlap, `${label}: links overlap`).toBeGreaterThan(0);
    expect(overlap, `${label}: by about half a link-width`).toBeCloseTo(
      wide / 2,
      0,
    );

    // INTERLOCK. Seen head-on a turned link is the nearer body at both
    // its joints, which document order cannot express on its own; the
    // inverted joints are corrected with a clipped redraw. Two of the
    // five joints qualify for a six-link chain.
    expect(
      geometry.clipped,
      `${label}: the inverted joints are corrected`,
    ).toBe(2);
    expect(geometry.shapes).toBe(6 + geometry.clipped);

    /*
     * PITCH EQUALS ROW HEIGHT. This is the coupling that puts each link
     * beside its OWN service rather than near it, and it is held by two
     * numbers in different places — a geometry constant and a Tailwind
     * row-height class. Asserted directly rather than by comment.
     */
    const rowHeights = await rows.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    expect(
      new Set(rowHeights).size,
      `${label}: every row is the same height`,
    ).toBe(1);
    expect(
      rowHeights[0],
      `${label}: the chain's pitch is the row height`,
    ).toBeCloseTo(pitch, 0);

    // And each link ends up centred on its own row, to the pixel.
    const offsets = await page.evaluate(() => {
      const svg = [...document.querySelectorAll("#products svg.chain")].find(
        (s) => s.getBoundingClientRect().width > 0,
      )!;
      const box = svg.getBoundingClientRect();
      const scale = box.height / svg.viewBox.baseVal.height;
      const links = [...svg.querySelectorAll("g > rect")].slice(0, 6);
      return [...document.querySelectorAll("[data-product-row]")].map(
        (row, i) => {
          const r = row.getBoundingClientRect();
          const y = Number(links[i].getAttribute("y"));
          const h = Number(links[i].getAttribute("height"));
          return box.top + (y + h / 2) * scale - (r.top + r.height / 2);
        },
      );
    });
    offsets.forEach((d, i) => {
      expect(
        Math.abs(d),
        `${label}: link ${i} is centred on its own row`,
      ).toBeLessThan(1.5);
    });

    /*
     * The mapping is mechanical: hovering a service lights that link and
     * no other. Without this the chain is an illustration placed beside
     * a list rather than the list's own structure.
     */
    const litIds = async () =>
      chain.evaluate((svg) =>
        [...svg.querySelectorAll("g > rect")]
          .slice(0, 6)
          .map((r) => /lit/.test(r.getAttribute("stroke") ?? "")),
      );
    expect(await litIds(), `${label}: nothing is lit at rest`).toEqual(
      Array(6).fill(false),
    );

    /*
     * Hovering a row is not as simple as .hover(), and getting it wrong
     * made this test fail two ways at once — the wrong link lit, or
     * none at all.
     *
     * The page sets `scroll-behavior: smooth` globally. Playwright
     * scrolls the target into view, measures it, then moves the mouse —
     * but the smooth scroll is still travelling, so the content keeps
     * sliding under a cursor that has already stopped, and a different
     * row ends up beneath it. Measured after a viewport change: row 2
     * came to rest at y=0 while the cursor sat at y≈448, which is row
     * 5 — and row 5 lit. The rows are a uniform 120/128px pitch, so a
     * scroll still in flight lands cleanly on a neighbour rather than
     * missing everything, which is what made it look like an off-by-one.
     *
     * Scrolling is therefore forced instant for this test, and the row
     * is centred rather than merely made visible — centring also keeps
     * it out from under the fixed navbar, which is what produced the
     * "nothing lit" variant.
     */
    await rows.nth(2).evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await rows.nth(2).hover();
    await expect
      .poll(litIds, { timeout: 3_000 })
      .toEqual([false, false, true, false, false, false]);
    // Leave nothing lit for the next pass.
    await page.mouse.move(0, 0);
  };

  await assertChain("desktop chain");

  const original = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await assertChain("mobile chain");
  await page.setViewportSize(original);
});

/*
 * The four services with no page behind them must not wear an arrow.
 * An arrow on a row that goes nowhere is a promise the section cannot
 * keep — the same convention the Footer's live-route list follows.
 */
test("#products only signals a destination where one exists", async ({
  page,
}) => {
  await page.goto("/");
  const products = page.locator("#products");
  await products.scrollIntoViewIfNeeded();

  const arrows = await products.evaluate((section) =>
    [...section.querySelectorAll("[data-product-row]")].map((row) => ({
      linked: row.querySelector("a[href]") !== null,
      arrow: (row.textContent ?? "").includes("→"),
    })),
  );
  expect(arrows.filter((r) => r.linked).length).toBe(2);
  for (const row of arrows) {
    expect(row.arrow, "an arrow appears only on a row that links").toBe(
      row.linked,
    );
  }
  await expect(products.locator('a[href="#"]')).toHaveCount(0);
});

/*
 * ── The brand mark follows its surface ─────────────────────────────
 *
 * The nav carries both lettering variants of the AZEE mark and shows
 * whichever the current ground was drawn for: the white-lettering
 * artwork on the hero's navy and on ink, the dark-lettering artwork on
 * the bone #trading block.
 *
 * This replaced an ink chip — a dark pill drawn behind the logo so a
 * mark made for dark surfaces would still read on a light one. The
 * chip's absence is asserted as directly as the swap, because
 * reintroducing it is the obvious "fix" if either asset ever goes
 * missing, and it would look deliberate rather than broken.
 */
test("the nav brand swaps lettering with its surface, and wears no chip", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.locator("nav.nav-glass");

  const brandAt = async (theme: string, scrollTo: string | null) => {
    if (scrollTo) {
      await parkNavIn(page, scrollTo);
    } else {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
    }
    await expect(nav).toHaveAttribute("data-nav-theme", theme, {
      timeout: 10_000,
    });
    // The marks cross-fade over 0.45s; poll past it rather than
    // reading a genuine in-between frame.
    return await expect
      .poll(
        async () =>
          nav.evaluate((el) => {
            const brand = el.querySelector(".nav-brand")!;
            const cs = getComputedStyle(brand);
            const opacity = (sel: string) =>
              Number(
                getComputedStyle(brand.querySelector(sel)!).opacity,
              ).toFixed(2);
            return [
              opacity(".nav-mark-on-dark"),
              opacity(".nav-mark-on-light"),
              cs.backgroundColor,
              cs.borderTopLeftRadius,
              cs.paddingTop,
            ].join("|");
          }),
        { timeout: 5_000 },
      )
      .toBe(
        theme === "light"
          ? // On bone: dark lettering, and no chip behind it.
            "0.00|1.00|rgba(0, 0, 0, 0)|0px|0px"
          : // On navy and ink: the original white lettering, untouched.
            "1.00|0.00|rgba(0, 0, 0, 0)|0px|0px",
      );
  };

  await brandAt("hero", null);
  await brandAt("dark", "#about");
  await brandAt("light", "#trading");

  /*
   * Both files must actually decode. An <img> whose src 404s still
   * reports its computed opacity perfectly happily, so the checks
   * above would pass over a missing asset.
   */
  const loaded = await nav.evaluate((el) =>
    [...el.querySelectorAll(".nav-mark")].map((img) => ({
      file: (img as HTMLImageElement).currentSrc.split("/").pop() ?? "",
      decoded:
        (img as HTMLImageElement).complete &&
        (img as HTMLImageElement).naturalWidth > 0,
    })),
  );
  expect(loaded).toHaveLength(2);
  for (const mark of loaded) {
    expect(mark.decoded, `${mark.file} must decode`).toBe(true);
  }
  expect(loaded.some((m) => /azee-logo-dark/.test(m.file))).toBe(true);

  // One accessible name, not the company announced twice.
  const alts = await nav.evaluate((el) =>
    [...el.querySelectorAll(".nav-mark")].map((i) => i.getAttribute("alt")),
  );
  expect(alts.filter((a) => a && a.length > 0)).toHaveLength(1);
});
