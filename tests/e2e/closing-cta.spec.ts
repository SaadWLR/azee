import { expect, test } from "./fixtures";

/*
 * The homepage conversion section — "Start investing".
 *
 * It is no longer a passive visual: it carries a working PSX symbol
 * lookup driven by the live market-watch feed. These tests exercise the
 * interaction for real and cross-check what it renders against the API
 * at the same moment, so a mockup or a stale hardcoded value could not
 * pass.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Conversion section is viewport-independent; run once on desktop",
  );
});

const SECTION = "#start-investing";
const LOOKUP = `${SECTION} input[type="text"]`;

test("sits fourth in the homepage order, before Research", async ({ page }) => {
  await page.goto("/");

  /*
   * It used to be last, reachable only after the entire page. Position
   * is asserted structurally — by vertical order against the sections
   * it must now precede — rather than by an index that any future
   * insertion would break.
   */
  const cta = await page.locator(SECTION).boundingBox();
  const research = await page.locator("#research").boundingBox();
  expect(cta, "conversion section renders").not.toBeNull();
  expect(research, "research section renders").not.toBeNull();
  expect(
    cta!.y,
    "the conversion section must come BEFORE the research section",
  ).toBeLessThan(research!.y);

  // And it is genuinely early: within the first ~2.5 screens.
  const viewport = page.viewportSize()!;
  expect(
    cta!.y / viewport.height,
    `conversion section starts ${(cta!.y / viewport.height).toFixed(1)} screens down`,
  ).toBeLessThan(3);
});

test("the symbol lookup is real: typed input returns the live quote for that symbol", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  const section = page.locator(SECTION);
  await section.scrollIntoViewIfNeeded();

  // The panel populates itself with a real quote before any input.
  await expect
    .poll(async () => (await section.innerText()).includes("PKR"), {
      timeout: 20_000,
    })
    .toBe(true);

  /*
   * Pull the live feed directly, pick a real symbol from it, and drive
   * the lookup with that symbol — then require the rendered price to
   * match what the API says for it. A hardcoded or fabricated panel
   * cannot satisfy this.
   */
  const target = await page.evaluate(async () => {
    const r = await fetch("/api/market/watch", {
      headers: { Accept: "application/json" },
    });
    const body = await r.json();
    const q = body.quotes.find(
      (x: { symbol: string; price: number }) =>
        x.symbol === "OGDC" && x.price > 0,
    );
    return q ?? body.quotes[0];
  });

  await page.locator(LOOKUP).fill(target.symbol);
  await page.waitForTimeout(500);

  const panel = await section.innerText();
  expect(panel, "the typed symbol is shown").toContain(target.symbol);

  const expectedPrice = target.price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  expect(
    panel,
    `panel must show ${target.symbol}'s live price ${expectedPrice}`,
  ).toContain(expectedPrice);

  // The company name from PSX's directory renders too, when it has one.
  if (target.name) {
    expect(panel).toContain(target.name);
  }

  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test("searching by company name and by sector both work", async ({ page }) => {
  await page.goto("/");
  const section = page.locator(SECTION);
  await section.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await section.innerText()).includes("PKR"), {
      timeout: 20_000,
    })
    .toBe(true);

  // A sector term the ticker itself does not contain — proves the
  // lookup reads the joined company/sector fields, not just symbols.
  await page.locator(LOOKUP).fill("CEMENT");
  await page.waitForTimeout(500);
  const bySector = await section.innerText();
  expect(bySector.toUpperCase()).toContain("CEMENT");

  await page.locator(LOOKUP).fill("Bank");
  await page.waitForTimeout(500);
  const byName = await section.innerText();
  expect(byName.toUpperCase()).toMatch(/BANK/);
});

test("most-active chips are live symbols and clicking one loads its quote", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator(SECTION);
  await section.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await section.innerText()).includes("PKR"), {
      timeout: 20_000,
    })
    .toBe(true);

  // The chips are derived from the live payload's top volume, never a
  // hardcoded list — so each must exist in the feed.
  const chips = await section
    .locator("button")
    .filter({ hasText: /^[A-Z0-9.\-]{2,12}$/ })
    .allInnerTexts();
  expect(chips.length).toBeGreaterThan(0);

  const feedSymbols = await page.evaluate(async () => {
    const r = await fetch("/api/market/watch", {
      headers: { Accept: "application/json" },
    });
    return (await r.json()).quotes.map((q: { symbol: string }) => q.symbol);
  });
  for (const chip of chips) {
    expect(feedSymbols, `chip ${chip} must be a real PSX symbol`).toContain(
      chip.trim(),
    );
  }

  // Clicking one loads that symbol's card.
  const first = chips[0].trim();
  await section.getByRole("button", { name: first, exact: true }).click();
  await page.waitForTimeout(400);
  await expect(section).toContainText(first);
  await expect(section).toContainText("PKR");
});

test("an unmatched search says so rather than inventing a quote", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator(SECTION);
  await section.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await section.innerText()).includes("PKR"), {
      timeout: 20_000,
    })
    .toBe(true);

  await page.locator(LOOKUP).fill("ZZZZ_NOT_A_SYMBOL");
  await page.waitForTimeout(500);
  await expect(section).toContainText(/No PSX symbol matches/i);
  // No fabricated price is left on screen.
  expect(await section.innerText()).not.toContain("PKR ");
});

test("the section keeps its CTA, its distinct warm treatment, and honest framing", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator(SECTION);
  await section.scrollIntoViewIfNeeded();

  // The conversion action's intent is preserved.
  await expect(
    section.getByRole("link", { name: /open a trading account/i }),
  ).toHaveAttribute("href", "/get-started");
  await expect(section.locator("h2")).toContainText("Make your move");

  /*
   * Distinct colour: this is the one section tinted with the brand
   * orange rather than navy, and its CTA is the site's only solid
   * orange button.
   */
  const ctaBg = await section
    .getByRole("link", { name: /open a trading account/i })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(ctaBg, "the primary CTA is solid brand orange").toBe(
    "rgb(233, 81, 38)",
  );

  // Honest framing about what the prices are.
  await expect(section).toContainText(/indicative and not an offer to trade/i);
  await expect(section).toContainText(/PSX ready board/i);

  // No fabricated performance/marketing claims.
  const copy = (await section.innerText()).toLowerCase();
  expect(copy).not.toMatch(
    /#1|\baward|\bguaranteed|\d+%\s*(returns?|profit|gains?)/,
  );
});

test("the Hero video and its live panel remain untouched", async ({ page }) => {
  /*
   * Guard for what is explicitly out of scope: the Hero keeps its
   * full-bleed rotating-globe footage and the live Market Snapshot
   * beside it.
   */
  await page.goto("/");
  const hero = page.locator("section").first();
  const heroVideo = hero.locator("video").first();
  await expect(heroVideo).toHaveAttribute(
    "src",
    /videos\.pexels\.com\/video-files\/3129957\/.*1920_1080/,
  );

  const vb = await heroVideo.boundingBox();
  const hb = await hero.boundingBox();
  expect(
    (vb!.width * vb!.height) / (hb!.width * hb!.height),
    "the Hero video must remain full-bleed",
  ).toBeGreaterThan(0.8);

  await expect(hero).toContainText("KSE-100");
});
