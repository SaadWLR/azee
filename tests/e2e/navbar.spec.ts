import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * Desktop-scoped: the bar is viewport-independent above 1024px, and the
 * phone-width checks below set their own viewport, so once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Navbar checks run once on desktop",
  );
});

/** The bar, left to right (Navbar's NAV_ENTRIES). */
const BAR = [
  "link:Home→/",
  "dropdown:Trade & Invest",
  "dropdown:Market",
  "dropdown:Tools",
  "link:Knowledge Centre→/knowledge-centre",
  "dropdown:Support",
];

/** Each dropdown's panel, top to bottom: sub-headings and links. */
const PANELS: Record<string, string[]> = {
  "Trade & Invest": [
    "link:Stocks→/market-watch",
    "link:Shariah Compliant Stocks→/market-watch?preset=kmiAllShare",
    "link:Futures→/indices?tab=global",
    "link:Commodities→/commodities",
    "link:Currency→/forex",
    "link:Mutual Funds→/mutual-funds",
  ],
  Market: [
    "heading:Stocks",
    "link:Market Watch→/market-watch",
    "link:ETFs→/etfs",
    "heading:Indices",
    "link:Pakistan Indices→/indices",
    "link:Global Indices→/global-indices",
    "link:Crypto→/crypto",
  ],
  Tools: [
    "heading:Calendars",
    "link:Dividend Calendar→/corporate-calendar?tab=payouts",
    "link:Corporate Calendar→/corporate-calendar",
    "link:IPO Calendar→/ipo",
    "link:Economic Calendar→/economic-calendar",
    "heading:Data & Research",
    "link:Announcements→/announcements",
    "link:Economic Dashboard→/economic-dashboard",
    "link:Fear and Optimism Index→/fear-and-optimism-index",
  ],
  Support: [
    "link:About Us→/about",
    "link:Contact Us→/contact",
    "link:Download Forms→/forms-downloads",
  ],
};

/** The h1 each linked route renders. */
const HEADINGS: Record<string, string | RegExp> = {
  "/market-watch": "Market Watch",
  "/market-watch?preset=kmiAllShare": "Market Watch",
  "/indices?tab=global": "Indices",
  "/commodities": "Commodity Futures",
  "/forex": "Forex & Commodities",
  "/mutual-funds": "Mutual Funds",
  "/etfs": "Exchange Traded Funds",
  "/indices": "Indices",
  "/global-indices": "Global Indices",
  "/crypto": "Crypto",
  "/corporate-calendar?tab=payouts": "Corporate Calendar",
  "/corporate-calendar": "Corporate Calendar",
  "/ipo": "IPOs",
  "/economic-calendar": "Economic Calendar",
  "/announcements": "Company Announcements",
  "/economic-dashboard": "Pakistan Economic Dashboard",
  "/fear-and-optimism-index": "Fear and Optimism Index",
  "/knowledge-centre": /Understand the market/,
  "/about": /AZEE Securities/,
  "/contact": "Get in touch",
  "/forms-downloads": "Forms & Downloads",
};

/** A whole class token: /bg-white/ alone would also match hover:bg-white/15. */
const token = (cls: string) =>
  new RegExp(`(^|\\s)${cls.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(\\s|$)`);

const trigger = (page: Page, heading: string) =>
  page.getByRole("button", { name: heading, exact: true });
const panel = (page: Page, heading: string) =>
  page.getByRole("menu", { name: heading, exact: true });

/** A panel's rows as "heading:…" / "link:label→href", in order. */
const panelRows = (page: Page, heading: string) =>
  panel(page, heading).evaluate((el) =>
    [...el.querySelectorAll('[role="presentation"], [role="menuitem"]')].map((row) =>
      row.getAttribute("role") === "menuitem"
        ? `link:${row.textContent!.trim()}→${row.getAttribute("href")}`
        : `heading:${row.textContent!.trim()}`,
    ),
  );

/** Which bar entries wear the active underline. */
const activeEntries = (page: Page) =>
  page
    .locator("header nav ul > li > .is-active")
    .evaluateAll((els) => els.map((el) => el.textContent!.trim()));

/** Labels marked aria-current in the desktop bar and its panels. */
const currentLinks = (page: Page) =>
  page
    .locator('header nav ul [aria-current="page"]')
    .evaluateAll((els) => els.map((el) => el.textContent!.trim()));

/**
 * Console errors that are not the PSX outage. While PSX's data
 * endpoints refuse Vercel (since Sep 2026), the market pages log a
 * "status of 503" resource error per failed call; anything else fails.
 */
function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/status of 503/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("the bar is Home, Trade & Invest, Market, Tools, Knowledge Centre and Support", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.locator("header nav ul > li").first().waitFor();
  const entries = await page.locator("header nav ul > li").evaluateAll((items) =>
    items.map((li) => {
      const el = li.firstElementChild!;
      return el.tagName === "BUTTON"
        ? `dropdown:${el.textContent!.trim()}`
        : `link:${el.textContent!.trim()}→${el.getAttribute("href")}`;
    }),
  );
  expect(entries).toEqual(BAR);

  // The old groups and plain entries are gone, with no client login and
  // no homepage section anchor (#… or /#…).
  for (const old of ["Markets", "Corporate & Events", "Research & News"]) {
    await expect(trigger(page, old)).toHaveCount(0);
  }
  const bar = page.locator("header nav ul");
  await expect(bar.getByRole("link", { name: "Forex & Commodities", exact: true })).toHaveCount(0);
  await expect(bar.getByRole("link", { name: "About", exact: true })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: /client login/i })).toHaveCount(0);
  await expect(page.locator('header a[href^="#"], header a[href*="/#"]')).toHaveCount(0);
});

test("each dropdown lists its own sub-headings and links, in order", async ({ page }) => {
  await page.goto("/contact");
  for (const [heading, rows] of Object.entries(PANELS)) {
    const button = trigger(page, heading);
    await expect(button).toHaveAttribute("aria-haspopup", "true");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const controls = await button.getAttribute("aria-controls");
    expect(controls, `${heading} names its panel`).toBeTruthy();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${controls}`)).toBeVisible();
    expect(await panelRows(page, heading)).toEqual(rows);

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  }
});

test("every link reaches a route that renders its heading, with no console errors", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackConsoleErrors(page);
  await page.goto("/contact");

  for (const [heading, rows] of Object.entries(PANELS)) {
    for (const row of rows.filter((r) => r.startsWith("link:"))) {
      const [label, href] = row.slice("link:".length).split("→");
      await trigger(page, heading).click();
      await panel(page, heading).getByRole("menuitem", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[?]/g, "\\?")}$`));
      await expect(page.locator("h1").first()).toHaveText(HEADINGS[href]);
      // The menu closes and the group owning the route is lit. Market
      // Watch shares its route with Trade & Invest's Stocks, which comes
      // first in the bar and so owns it (see the active-state test).
      await expect(trigger(page, heading)).toHaveAttribute("aria-expanded", "false");
      const owner = href === "/market-watch" ? "Trade & Invest" : heading;
      await expect.poll(() => activeEntries(page), { message: label }).toEqual([owner]);
    }
  }

  // The plain entries.
  await page.locator("header nav ul").getByRole("link", { name: "Knowledge Centre", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge-centre$/);
  await expect(page.locator("h1").first()).toHaveText(HEADINGS["/knowledge-centre"]);
  await page.locator("header nav ul").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#markets")).toBeAttached();

  expect(errors).toEqual([]);
});

test("the three deep links open their views on a cold load", async ({ page }) => {
  // Shariah Compliant Stocks: Market Watch's KMI All-Share filter.
  await page.goto("/market-watch?preset=kmiAllShare");
  const presets = page.locator("main").getByRole("button");
  await expect(presets.filter({ hasText: /^KMI All-Share$/ })).toHaveClass(token("bg-white"));
  await expect(presets.filter({ hasText: /^All$/ })).not.toHaveClass(token("bg-white"));

  // Dividend Calendar: the Payouts tab of the corporate calendar.
  await page.goto("/corporate-calendar?tab=payouts");
  await expect(page.getByRole("tab", { name: "Payouts" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Meetings" })).toHaveAttribute("aria-selected", "false");

  // Futures: the Global Futures tab of the indices page.
  await page.goto("/indices?tab=global");
  await expect(page.getByRole("tab", { name: "Global Futures" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("the Shariah link filters Market Watch in place, and the URL follows the chips", async ({
  page,
}) => {
  await page.goto("/market-watch");
  const presets = page.locator("main").getByRole("button");
  await expect(presets.filter({ hasText: /^All$/ })).toHaveClass(token("bg-white"));

  // In-app navigation within the page already showing.
  await trigger(page, "Trade & Invest").click();
  await panel(page, "Trade & Invest")
    .getByRole("menuitem", { name: "Shariah Compliant Stocks", exact: true })
    .click();
  await expect(page).toHaveURL(/\/market-watch\?preset=kmiAllShare$/);
  await expect(presets.filter({ hasText: /^KMI All-Share$/ })).toHaveClass(token("bg-white"));
  await expect.poll(() => currentLinks(page)).toEqual(["Shariah Compliant Stocks"]);

  // A chip writes the URL, so the nav follows the table.
  await presets.filter({ hasText: /^All$/ }).click();
  await expect(page).toHaveURL(/\/market-watch$/);
  await expect.poll(() => currentLinks(page)).toEqual(["Stocks"]);
  await presets.filter({ hasText: /^KMI-30$/ }).click();
  await expect(page).toHaveURL(/\/market-watch\?preset=kmi30$/);
  await expect.poll(() => currentLinks(page)).toEqual(["Stocks"]);

  // And the Stocks link brings back the unfiltered table.
  await trigger(page, "Trade & Invest").click();
  await panel(page, "Trade & Invest").getByRole("menuitem", { name: "Stocks", exact: true }).click();
  await expect(page).toHaveURL(/\/market-watch$/);
  await expect(presets.filter({ hasText: /^All$/ })).toHaveClass(token("bg-white"));
});

test("exactly one entry is active, decided by route and query", async ({ page }) => {
  const cases: [string, string[], string[]][] = [
    // [url, active bar entries, aria-current links]
    ["/", ["Home"], ["Home"]],
    ["/market-watch", ["Trade & Invest"], ["Stocks"]],
    ["/market-watch?preset=kmiAllShare", ["Trade & Invest"], ["Shariah Compliant Stocks"]],
    ["/market-watch?preset=gainers", ["Trade & Invest"], ["Stocks"]],
    ["/indices", ["Market"], ["Pakistan Indices"]],
    ["/indices?tab=global", ["Trade & Invest"], ["Futures"]],
    ["/corporate-calendar", ["Tools"], ["Corporate Calendar"]],
    ["/corporate-calendar?tab=payouts", ["Tools"], ["Dividend Calendar"]],
    ["/forex", ["Trade & Invest"], ["Currency"]],
    ["/crypto", ["Market"], ["Crypto"]],
    ["/knowledge-centre", ["Knowledge Centre"], ["Knowledge Centre"]],
    ["/about", ["Support"], ["About Us"]],
    ["/forms-downloads", ["Support"], ["Download Forms"]],
    ["/get-started", [], []],
  ];
  for (const [url, entries, current] of cases) {
    await page.goto(url);
    await page.locator("header nav ul > li").first().waitFor();
    await expect.poll(() => activeEntries(page), { message: url }).toEqual(entries);
    expect(await currentLinks(page), url).toEqual(current);
  }

  // The highlighted row inside the panel is the active link.
  await page.goto("/corporate-calendar?tab=payouts");
  await trigger(page, "Tools").click();
  await expect(
    panel(page, "Tools").getByRole("menuitem", { name: "Dividend Calendar", exact: true }),
  ).toHaveClass(token("bg-white/10"));
  await expect(
    panel(page, "Tools").getByRole("menuitem", { name: "Corporate Calendar", exact: true }),
  ).not.toHaveClass(token("bg-white/10"));
});

test("a dropdown closes on its trigger, Escape and an outside press; one is open at a time", async ({
  page,
}) => {
  await page.goto("/contact");
  const tools = trigger(page, "Tools");

  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "false");

  await tools.click();
  await page.keyboard.press("Escape");
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await expect(tools).toBeFocused();

  await tools.click();
  await page.evaluate(() =>
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  await expect(tools).toHaveAttribute("aria-expanded", "false");

  for (const heading of Object.keys(PANELS)) {
    await trigger(page, heading).click();
    await expect(trigger(page, heading)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("header [aria-expanded='true']")).toHaveCount(1);
  }
});

test("keyboard: closed panels are out of the tab order, Escape returns focus, tabbing out closes", async ({
  page,
}) => {
  await page.goto("/contact");
  const home = page.locator("header nav ul").getByRole("link", { name: "Home", exact: true });
  const tradeInvest = trigger(page, "Trade & Invest");
  const market = trigger(page, "Market");

  // From Home, Tab goes to the next trigger — never into a closed panel.
  await home.focus();
  await page.keyboard.press("Tab");
  await expect(tradeInvest).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(market).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tradeInvest).toBeFocused();

  // Enter opens; Tab walks the links in order.
  await page.keyboard.press("Enter");
  await expect(tradeInvest).toHaveAttribute("aria-expanded", "true");
  const links = PANELS["Trade & Invest"].map((r) => r.slice("link:".length).split("→")[0]);
  for (const label of links) {
    await page.keyboard.press("Tab");
    await expect(
      panel(page, "Trade & Invest").getByRole("menuitem", { name: label, exact: true }),
    ).toBeFocused();
  }

  // Escape closes and puts focus back on the trigger.
  await page.keyboard.press("Escape");
  await expect(tradeInvest).toHaveAttribute("aria-expanded", "false");
  await expect(tradeInvest).toBeFocused();

  // Tabbing past the last link closes the panel and moves on to Market.
  await page.keyboard.press("Enter");
  for (let i = 0; i < links.length + 1; i++) await page.keyboard.press("Tab");
  await expect(market).toBeFocused();
  await expect(tradeInvest).toHaveAttribute("aria-expanded", "false");
});

test("each panel is centred under its trigger and inside the viewport", async ({ page }) => {
  await page.goto("/contact");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const heading of Object.keys(PANELS)) {
      await trigger(page, heading).click();
      await expect(trigger(page, heading)).toHaveAttribute("aria-expanded", "true");
      await expect
        .poll(async () =>
          page.evaluate((name) => {
            const button = [...document.querySelectorAll("header nav ul > li > button")].find(
              (b) => b.textContent!.trim() === name,
            )!;
            const t = button.getBoundingClientRect();
            const p = document.getElementById(button.getAttribute("aria-controls")!)!.getBoundingClientRect();
            const vw = document.documentElement.clientWidth;
            const offCentre = Math.abs(p.left + p.width / 2 - (t.left + t.width / 2));
            return p.left >= 16 && p.right <= vw - 16 && offCentre <= 1
              ? "ok"
              : JSON.stringify({ left: p.left, right: p.right, vw, offCentre });
          }, heading),
          { message: `${heading} at ${width}px` },
        )
        .toBe("ok");
      await page.keyboard.press("Escape");
    }
  }
});

test("the links sit balanced between the logo and the bar's edge, on one line", async ({
  page,
}) => {
  await page.goto("/market-watch");
  /*
   * The bar is a justify-between row; without the list's auto margins
   * all its free space would fall between the logo and Home. The gap
   * before the first entry and after the last must match, at every width
   * the desktop bar is shown at, and no label may wrap.
   */
  for (const width of [1024, 1152, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const m = await page.locator("header nav").evaluate((nav) => {
          const shown = [...nav.children].filter((c) => getComputedStyle(c).display !== "none");
          const brand = nav.querySelector(".nav-brand")!.getBoundingClientRect();
          const items = [...nav.querySelectorAll("ul > li > :is(a, button)")];
          const first = items[0].getBoundingClientRect();
          const last = items.at(-1)!.getBoundingClientRect();
          const innerRight =
            nav.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(nav).paddingRight);
          return {
            shown: shown.map((c) => c.tagName).join(","),
            before: Math.round(first.left - brand.right),
            after: Math.round(innerRight - last.right),
            oneLine: items.every((el) => el.getBoundingClientRect().height <= 24),
          };
        });
        return m.shown === "A,UL" &&
          m.oneLine &&
          m.before >= 16 &&
          m.after >= 16 &&
          Math.abs(m.before - m.after) <= 2
          ? "balanced"
          : `${width}px: ${JSON.stringify(m)}`;
      }, { timeout: 5_000 })
      .toBe("balanced");
  }
});

test("Home returns to / and is active there; on the homepage it scrolls back to the top", async ({
  page,
}) => {
  await page.goto("/about");
  const home = page.locator("header nav ul").getByRole("link", { name: "Home", exact: true });
  await expect.poll(() => activeEntries(page)).toEqual(["Support"]);

  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#markets")).toBeAttached();
  await expect.poll(() => activeEntries(page)).toEqual(["Home"]);

  /*
   * Already home: the click must not be a silent no-op. The router only
   * resets scroll when the path or hash changes, so without its own
   * handler Home would do nothing down the page.
   */
  await page.locator("#research").evaluate((el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await home.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
  await expect(page).toHaveURL(/\/$/);
});

test("scrolling the homepage lights no entry but Home — there is no scroll-spy", async ({
  page,
}) => {
  await page.goto("/");
  /*
   * Each section is re-centred on every attempt because the homepage is
   * still growing while it loads, which moves a single early scroll off
   * target.
   */
  for (const id of ["about", "trading", "research"]) {
    await expect
      .poll(
        async () => {
          await page.locator(`#${id}`).evaluate((el) =>
            el.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await page.waitForTimeout(300);
          return activeEntries(page);
        },
        { timeout: 15_000 },
      )
      .toEqual(["Home"]);
  }
});

/* ── The mobile menu, at tablet and phone widths ───────────────── */

/*
 * Opened on /contact, never the homepage: the homepage's running
 * animations hold every click until its target is still for two frames
 * (see touch-device.spec.ts). Clicks here, taps there.
 */
const MOBILE_MENU = "#mobile-menu";
const VIEW = `${MOBILE_MENU} [data-menu-view]`;

/** The mobile view's rows as group/link/heading strings, in order. */
const mobileRows = (page: Page) =>
  page.locator(VIEW).evaluate((view) =>
    [...view.querySelectorAll(":scope > li > :is(a, button), :scope ul > li")].flatMap((el) => {
      if (el.tagName === "BUTTON") return [`group:${el.textContent!.trim()}`];
      if (el.tagName === "A") return [`link:${el.textContent!.trim()}→${el.getAttribute("href")}`];
      const link = el.querySelector("a");
      if (link) return [`link:${link.textContent!.trim()}→${link.getAttribute("href")}`];
      const text = el.textContent!.trim();
      return text ? [`heading:${text}`] : [];
    }),
  );

for (const width of [768, 390]) {
  test(`mobile menu at ${width}px drills in and out of every group, inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/contact");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    const menu = page.locator(MOBILE_MENU);
    await expect(menu).toBeVisible();

    const inside = () =>
      menu.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
      });

    expect(await mobileRows(page)).toEqual(
      BAR.map((entry) => entry.replace(/^dropdown:/, "group:")),
    );
    expect(await inside()).toBe(true);

    for (const [heading, rows] of Object.entries(PANELS)) {
      await menu.getByRole("button", { name: heading, exact: true }).click();
      // The view names its group, then lists the panel's rows.
      expect(await mobileRows(page)).toEqual([`heading:${heading}`, ...rows]);
      expect(await inside(), `${heading} view inside the viewport`).toBe(true);
      await menu.getByRole("button", { name: "Back", exact: true }).click();
      expect(await page.locator(VIEW).getAttribute("data-menu-view")).toBe("main");
    }
  });
}

test("mobile menu: keyboard drill-down moves focus, Escape closes, and a link navigates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  const toggle = page.getByRole("button", { name: "Open menu" });
  const menu = page.locator(MOBILE_MENU);

  // Closed, the menu is inert: none of its links can take focus.
  await expect(menu).toHaveAttribute("inert", "");

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(menu).not.toHaveAttribute("inert", "");

  const tools = menu.getByRole("button", { name: "Tools", exact: true });
  await tools.focus();
  await page.keyboard.press("Enter");
  const back = menu.getByRole("button", { name: "Back", exact: true });
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tools).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  // A drilled link navigates and closes the menu.
  await toggle.click();
  await menu.getByRole("button", { name: "Support", exact: true }).click();
  await menu.getByRole("link", { name: "Download Forms", exact: true }).click();
  await expect(page).toHaveURL(/\/forms-downloads$/);
  await expect(page.locator("h1").first()).toHaveText("Forms & Downloads");
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
