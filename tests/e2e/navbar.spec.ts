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

test("the bar is three dropdowns then three plain links, with no Tools trigger", async ({
  page,
}) => {
  await page.goto("/");

  const entries = await page.locator("header nav ul > li").evaluateAll((items) =>
    items.map((li) => {
      const el = li.firstElementChild!;
      return `${el.tagName === "BUTTON" ? "dropdown" : "link"}:${el.textContent!.trim()}`;
    }),
  );
  expect(entries).toEqual([
    "dropdown:Markets",
    "dropdown:Corporate & Events",
    "dropdown:Research & News",
    "link:Trading",
    "link:Forex & Commodities",
    "link:About",
  ]);

  // Tools is gone, and so are the Markets / Research section anchors
  // whose positions the groups took. The sections themselves stay; see
  // cross-route-navigation.spec.ts.
  await expect(page.getByRole("button", { name: /^tools$/i })).toHaveCount(0);
  await expect(page.locator('header nav a[href="#markets"]')).toHaveCount(0);
  await expect(page.locator('header nav a[href="#research"]')).toHaveCount(0);
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

test("Client Login is gone from the desktop bar, leaving no empty slot", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: /client login/i })).toHaveCount(0);
  await expect(header.locator('a[href="/get-started"]')).toHaveCount(0);

  /*
   * No residue: the bar's only rendered children are the brand and the
   * link list (the mobile toggle is display:none at desktop widths), and
   * the list sits flush against the bar's right padding rather than
   * leaving a gap where the button used to be.
   */
  const layout = await page.locator("header nav").evaluate((nav) => {
    const shown = [...nav.children].filter((c) => getComputedStyle(c).display !== "none");
    const list = nav.querySelector("ul")!.getBoundingClientRect();
    const bar = nav.getBoundingClientRect();
    return {
      shown: shown.length,
      lastIsList: shown.at(-1)?.tagName === "UL",
      rightGap: Math.round(bar.right - list.right),
      padRight: Math.round(Number.parseFloat(getComputedStyle(nav).paddingRight)),
    };
  });
  expect(layout.shown).toBe(2);
  expect(layout.lastIsList).toBe(true);
  expect(Math.abs(layout.rightGap - layout.padRight)).toBeLessThanOrEqual(2);
});

/**
 * Scroll `selector` into position on every poll attempt and read which
 * bar entries are highlighted. Re-scrolling each attempt is what makes
 * this reliable — see the scroll-spy test below.
 */
async function activeAfterScroll(page: Page, scroll: () => Promise<void>) {
  await scroll();
  return page
    .locator("header nav ul > li > .is-active")
    .evaluateAll((els) => els.map((el) => el.textContent!.trim()));
}

test("scroll-spy activates section anchors on the homepage", async ({ page }) => {
  await page.goto("/");

  /*
   * Re-centre on every attempt rather than scrolling once and waiting.
   *
   * The old form scrolled immediately after goto and then waited up to
   * ten seconds for the anchor to light. That is a race the homepage
   * usually lost: it is still growing while it loads — video, fonts,
   * two live feeds — so a scroll issued at that moment lands somewhere
   * else by the time the page stops moving, and nothing scrolls again.
   * The spy is then correctly reporting whichever section actually
   * ended up in its band, and the assertion blames the spy for the
   * test's own timing.
   *
   * It went from passing to failing four runs in five when the display
   * face was reverted, because Inter reflows the sections above this
   * one and changed how far the page shifts after load — the race was
   * always there, that just tipped which way it usually fell.
   *
   * Scrolling inside the poll makes it immune: each attempt puts the
   * section back in the middle of whatever the layout is NOW. Instant,
   * because the smooth scrolling the site sets is not what this test is
   * about.
   *
   * Uses #trading: #research has had no bar anchor since the groups
   * became top-level dropdowns.
   */
  await expect
    .poll(
      async () => {
        await page.locator("#trading").evaluate((el) =>
          el.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        return page
          .locator('header nav a[href="#trading"]')
          .evaluate((el) => el.className);
      },
      { timeout: 15_000 },
    )
    .toMatch(/is-active/);
});

test("scroll-spy clears the highlight over sections that have no bar entry", async ({
  page,
}) => {
  await page.goto("/");
  const centre = (id: string) => () =>
    page.locator(`#${id}`).evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  const toTop = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

  /*
   * The spy used to only ever set a highlight, never clear one. That was
   * invisible while the hero (#markets) and #research had bar anchors of
   * their own, since one of them always took over. Without them,
   * scrolling back up to the hero left "About" underlined over it, and
   * "Trading" stayed lit over Research — both measured before the fix.
   */
  await expect.poll(() => activeAfterScroll(page, centre("about")), { timeout: 15_000 }).toEqual(["About"]);
  await expect.poll(() => activeAfterScroll(page, toTop), { timeout: 15_000 }).toEqual([]);

  await expect.poll(() => activeAfterScroll(page, centre("trading")), { timeout: 15_000 }).toEqual(["Trading"]);
  await expect.poll(() => activeAfterScroll(page, centre("research")), { timeout: 15_000 }).toEqual([]);
});
