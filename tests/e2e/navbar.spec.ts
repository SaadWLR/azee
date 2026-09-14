import { expect, test } from "./fixtures";

/*
 * Desktop-scoped: the Tools dropdown and scroll-spy are desktop-nav
 * behaviours, viewport-independent otherwise, so once on desktop.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Navbar dropdown/scroll-spy checks run once on desktop",
  );
});

test("Tools dropdown: opens/closes (click, Escape, outside), active on tool routes, lists all tools", async ({
  page,
}) => {
  // Start on a tool route so the active-state can be checked.
  await page.goto("/market-watch");

  const trigger = page.getByRole("button", { name: /^tools$/i });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-haspopup", "true");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  // On /market-watch the trigger wears the active underline.
  await expect(trigger).toHaveClass(/is-active/);

  const menu = page.getByRole("menu", { name: /tools/i });

  // Open on click → ten tools across three labelled groups.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveCount(10);

  // Three groups, in order, each holding exactly its own links, in order.
  const groups = menu.getByRole("group");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0)).toHaveAttribute("aria-label", "Markets");
  await expect(groups.nth(0).getByRole("menuitem")).toHaveText([
    "Market Watch",
    "PSX Indices",
    "PMEX Commodities",
    "ETFs",
    "Mutual Funds",
  ]);
  await expect(groups.nth(1)).toHaveAttribute("aria-label", "Corporate & Events");
  await expect(groups.nth(1).getByRole("menuitem")).toHaveText([
    "Company Announcements",
    "Corporate Calendar",
    "Economic Dashboard",
  ]);
  // Knowledge Centre is back in Tools; the footer is its second path.
  await expect(groups.nth(2)).toHaveAttribute("aria-label", "Research & News");
  await expect(groups.nth(2).getByRole("menuitem")).toHaveText([
    "Knowledge Centre",
    "Fear and Optimism Index",
  ]);
  // Current route's item is highlighted inside the panel.
  await expect(
    menu.getByRole("menuitem", { name: "Market Watch" }),
  ).toHaveClass(/bg-white\/10/);

  // Close on trigger again.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  // Close on Escape.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  // Close on an outside pointer press.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    ),
  );
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("dropdown link navigates, closes the menu, and highlights Tools on the new route", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /^tools$/i });

  await trigger.click();
  // Uses a Research & News item, so the last of the three groups is
  // exercised end to end, not just listed.
  await page
    .getByRole("menuitem", { name: "Fear and Optimism Index" })
    .click();

  await expect(page).toHaveURL(/\/fear-and-optimism-index$/);
  await expect(trigger).toHaveClass(/is-active/); // Tools active on that route
  await expect(trigger).toHaveAttribute("aria-expanded", "false"); // closed after nav
});

test("the two newly linked tools load from the dropdown", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /^tools$/i });

  // Mutual Funds is an honest placeholder page — "Content pending" is
  // its correct, expected state, not a failure.
  await page.goto("/");
  await trigger.click();
  await page.getByRole("menuitem", { name: "Mutual Funds" }).click();
  await expect(page).toHaveURL(/\/mutual-funds$/);
  await expect(page.locator("main")).toContainText("Content pending");
  await expect(trigger).toHaveClass(/is-active/);

  await page.goto("/");
  await trigger.click();
  await page.getByRole("menuitem", { name: "Knowledge Centre" }).click();
  await expect(page).toHaveURL(/\/knowledge-centre$/);
  await expect(page.locator("h1")).toBeVisible();
  await expect(trigger).toHaveClass(/is-active/);
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

test("scroll-spy still activates section anchors on the homepage (unaffected by the restructure)", async ({
  page,
}) => {
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
   * Scrolling inside the poll makes it immune: each attempt puts
   * #research back in the middle of whatever the layout is NOW.
   * Instant, because the smooth scrolling the site sets is not what
   * this test is about.
   */
  await expect
    .poll(
      async () => {
        await page.locator("#research").evaluate((el) =>
          el.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        return page
          .locator('header nav a[href="#research"]')
          .evaluate((el) => el.className);
      },
      { timeout: 15_000 },
    )
    .toMatch(/is-active/);
});
