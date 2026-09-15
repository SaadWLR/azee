import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * Desktop-scoped: the dropdowns and scroll-spy are desktop-nav
 * behaviours, viewport-independent otherwise, so once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Navbar dropdown/scroll-spy checks run once on desktop",
  );
});

/** The three top-level dropdowns, in bar order, each with its links in order. */
const GROUPS = [
  {
    heading: "Markets",
    links: ["Market Watch", "PSX Indices", "PMEX Commodities", "ETFs", "Mutual Funds"],
  },
  {
    heading: "Corporate & Events",
    links: ["Company Announcements", "Corporate Calendar", "Economic Dashboard"],
  },
  {
    heading: "Research & News",
    links: ["Knowledge Centre", "Fear and Optimism Index"],
  },
];

const trigger = (page: Page, heading: string) =>
  page.getByRole("button", { name: heading, exact: true });
const panel = (page: Page, heading: string) =>
  page.getByRole("menu", { name: heading, exact: true });

test("the bar is Home, three dropdowns, Forex & Commodities and About — all routes", async ({
  page,
}) => {
  await page.goto("/");

  const entries = await page.locator("header nav ul > li").evaluateAll((items) =>
    items.map((li) => {
      const el = li.firstElementChild!;
      return el.tagName === "BUTTON"
        ? `dropdown:${el.textContent!.trim()}`
        : `link:${el.textContent!.trim()}→${el.getAttribute("href")}`;
    }),
  );
  expect(entries).toEqual([
    "link:Home→/",
    "dropdown:Markets",
    "dropdown:Corporate & Events",
    "dropdown:Research & News",
    "link:Forex & Commodities→/forex",
    "link:About→/about",
  ]);

  // Trading and Tools are gone, and no entry is a homepage section anchor
  // any more — same-page (#…) or cross-route (/#…). The sections
  // themselves stay; see cross-route-navigation.spec.ts.
  await expect(page.locator("header nav").getByRole("link", { name: "Trading" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^tools$/i })).toHaveCount(0);
  await expect(page.locator('header a[href^="#"], header a[href*="/#"]')).toHaveCount(0);
});

test("each dropdown lists exactly its own links, in order", async ({ page }) => {
  await page.goto("/");

  for (const group of GROUPS) {
    const button = trigger(page, group.heading);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-haspopup", "true");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page, group.heading).getByRole("menuitem")).toHaveText(group.links);

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  }
});

test("a dropdown opens/closes (click, Escape, outside) and is active only on its own routes", async ({
  page,
}) => {
  // Start on a Markets route so the active state can be checked.
  await page.goto("/market-watch");

  const markets = trigger(page, "Markets");
  await expect(markets).toHaveClass(/is-active/);
  // The other two groups do not claim a route that is not theirs.
  await expect(trigger(page, "Corporate & Events")).not.toHaveClass(/is-active/);
  await expect(trigger(page, "Research & News")).not.toHaveClass(/is-active/);

  // Open on click; the current route's item is highlighted inside the panel.
  await markets.click();
  await expect(markets).toHaveAttribute("aria-expanded", "true");
  await expect(
    panel(page, "Markets").getByRole("menuitem", { name: "Market Watch" }),
  ).toHaveClass(/bg-white\/10/);

  // Close on trigger again.
  await markets.click();
  await expect(markets).toHaveAttribute("aria-expanded", "false");

  // Close on Escape, which returns focus to the trigger.
  await markets.click();
  await expect(markets).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(markets).toHaveAttribute("aria-expanded", "false");
  await expect(markets).toBeFocused();

  // Close on an outside pointer press.
  await markets.click();
  await expect(markets).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() =>
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  await expect(markets).toHaveAttribute("aria-expanded", "false");
});

test("opening one dropdown closes the other, so only one panel is ever open", async ({
  page,
}) => {
  await page.goto("/");
  const markets = trigger(page, "Markets");
  const corporate = trigger(page, "Corporate & Events");
  const research = trigger(page, "Research & News");

  await markets.click();
  await expect(markets).toHaveAttribute("aria-expanded", "true");

  await corporate.click();
  await expect(corporate).toHaveAttribute("aria-expanded", "true");
  await expect(markets).toHaveAttribute("aria-expanded", "false");

  await research.click();
  await expect(research).toHaveAttribute("aria-expanded", "true");
  await expect(corporate).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("header [aria-expanded='true']")).toHaveCount(1);
});

test("dropdown link navigates, closes the menu, and highlights its group on the new route", async ({
  page,
}) => {
  await page.goto("/");
  const research = trigger(page, "Research & News");

  // A Corporate & Events item and a Research & News item, so every group
  // is exercised end to end (Markets is, by the next test).
  await trigger(page, "Corporate & Events").click();
  await panel(page, "Corporate & Events")
    .getByRole("menuitem", { name: "Corporate Calendar" })
    .click();
  await expect(page).toHaveURL(/\/corporate-calendar$/);
  await expect(trigger(page, "Corporate & Events")).toHaveClass(/is-active/);
  await expect(trigger(page, "Corporate & Events")).toHaveAttribute("aria-expanded", "false");

  await research.click();
  await panel(page, "Research & News")
    .getByRole("menuitem", { name: "Fear and Optimism Index" })
    .click();

  await expect(page).toHaveURL(/\/fear-and-optimism-index$/);
  await expect(research).toHaveClass(/is-active/); // its group is active on that route
  await expect(research).toHaveAttribute("aria-expanded", "false"); // closed after nav
  await expect(trigger(page, "Corporate & Events")).not.toHaveClass(/is-active/);
});

test("Mutual Funds and Knowledge Centre load from their groups", async ({ page }) => {
  // Mutual Funds is an honest placeholder page — "Content pending" is
  // its correct, expected state, not a failure.
  await page.goto("/");
  await trigger(page, "Markets").click();
  await panel(page, "Markets").getByRole("menuitem", { name: "Mutual Funds" }).click();
  await expect(page).toHaveURL(/\/mutual-funds$/);
  await expect(page.locator("main")).toContainText("Content pending");
  await expect(trigger(page, "Markets")).toHaveClass(/is-active/);

  // Knowledge Centre keeps its footer link as a second path.
  await page.goto("/");
  await trigger(page, "Research & News").click();
  await panel(page, "Research & News")
    .getByRole("menuitem", { name: "Knowledge Centre" })
    .click();
  await expect(page).toHaveURL(/\/knowledge-centre$/);
  await expect(page.locator("h1")).toBeVisible();
  await expect(trigger(page, "Research & News")).toHaveClass(/is-active/);
});

test("Client Login stays gone, and the links sit balanced between the logo and the bar's edge", async ({
  page,
}) => {
  await page.goto("/market-watch");
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: /client login/i })).toHaveCount(0);
  await expect(header.locator('a[href="/get-started"]')).toHaveCount(0);

  /*
   * The right-skew this guards against (measured, Sep 2026): with Client
   * Login gone the bar was a two-child justify-between row, so ALL its
   * free space fell between the logo and Home — 104px at 1024, 280px
   * from 1280 — while About sat 1px from the bar's inner edge. The fix
   * centres the links in the space after the logo, so the gap before
   * the first entry and the gap after the last must match, at every
   * width the desktop bar is shown at, not just the widest.
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
            // No residue: only the logo and the list render at desktop
            // widths (the mobile toggle is display:none).
            shown: shown.map((c) => c.tagName).join(","),
            before: Math.round(first.left - brand.right),
            after: Math.round(innerRight - last.right),
            oneLine: items.every((el) => el.getBoundingClientRect().height <= 24),
          };
        });
        return (
          m.shown === "A,UL" &&
          m.oneLine &&
          m.before >= 16 &&
          m.after >= 16 &&
          Math.abs(m.before - m.after) <= 2
        )
          ? "balanced"
          : `${width}px: ${JSON.stringify(m)}`;
      }, { timeout: 5_000 })
      .toBe("balanced");
  }
});

/** Which bar entries currently wear the active underline. */
const activeEntries = (page: Page) =>
  page
    .locator("header nav ul > li > .is-active")
    .evaluateAll((els) => els.map((el) => el.textContent!.trim()));

test("About opens the real /about page instead of scrolling the homepage", async ({
  page,
}) => {
  await page.goto("/");
  const about = page.locator("header nav ul").getByRole("link", { name: "About", exact: true });
  await expect(about).toHaveAttribute("href", "/about");

  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#about")).toHaveCount(0); // the page, not the homepage section
  await expect.poll(() => activeEntries(page)).toEqual(["About"]);
});

test("Home returns to / and is active there; on the homepage it scrolls back to the top", async ({
  page,
}) => {
  await page.goto("/about");
  const home = page.locator("header nav ul").getByRole("link", { name: "Home", exact: true });
  await expect.poll(() => activeEntries(page)).toEqual(["About"]);

  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#markets")).toBeAttached();
  await expect.poll(() => activeEntries(page)).toEqual(["Home"]);

  /*
   * Already home: the click must not be a silent no-op. The router only
   * resets scroll when the path or hash changes, so without its own
   * handler Home would do nothing down the page. The page is scrolled
   * once; the click alone has to bring it back to the top.
   */
  await page.locator("#research").evaluate((el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await home.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
  await expect(page).toHaveURL(/\/$/);
});

test("scrolling the homepage lights no entry — there is no scroll-spy left", async ({
  page,
}) => {
  await page.goto("/");

  /*
   * Trading and About were the last section anchors, lit by a scroll-spy
   * while their sections were in view. Both left the bar (Trading
   * removed, About now a route), and the spy went with them. Over each
   * former target, only Home — active by route — may be lit. Each
   * section is re-centred on every attempt because the homepage is still
   * growing while it loads, which moves a single early scroll off target.
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
