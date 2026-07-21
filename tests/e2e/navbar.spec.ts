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
  await expect(trigger).toHaveClass(/after:w-6/);

  const menu = page.getByRole("menu", { name: /tools/i });

  // Open on click → all four tools present.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveCount(4);
  await expect(
    menu.getByRole("menuitem", { name: "Knowledge Centre" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Indices" }),
  ).toBeVisible();
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
  await page.getByRole("menuitem", { name: "Knowledge Centre" }).click();

  await expect(page).toHaveURL(/\/knowledge-centre$/);
  await expect(trigger).toHaveClass(/after:w-6/); // Tools active on KC page
  await expect(trigger).toHaveAttribute("aria-expanded", "false"); // closed after nav
});

test("scroll-spy still activates section anchors on the homepage (unaffected by the restructure)", async ({
  page,
}) => {
  await page.goto("/");
  // Centre the Research section in the viewport so it falls inside the
  // scroll-spy observer's middle band.
  await page.locator("#research").evaluate((el) =>
    el.scrollIntoView({ block: "center" }),
  );
  // The Research top-level anchor should light up (its underline grows).
  await expect(page.locator('header nav a[href="#research"]')).toHaveClass(
    /after:w-6/,
    { timeout: 10_000 },
  );
});
