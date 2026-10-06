import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/*
 * The interface-only routes: /ipo, /economic-calendar, /global-indices
 * and /crypto, plus /mutual-funds, which they share a shell with.
 *
 * THE POINT OF THIS SPEC is the thing that is easiest to break by
 * accident later: a placeholder that starts showing a number. A sample
 * row added "just to see the layout" is indistinguishable, to a
 * reader, from live data — so every page here is asserted to carry its
 * column headers, its empty state, and NO numeric row at all.
 *
 * Desktop-scoped like the other functional specs, to manage the
 * suite's known rate-limit thin margin. Overflow is checked at the
 * four widths the design is built for.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Pending-page content is viewport-independent; widths are checked explicitly below",
  );
});

interface PendingRoute {
  path: string;
  heading: string;
  columns: string[];
}

const ROUTES: PendingRoute[] = [
  {
    path: "/ipo",
    heading: "IPOs",
    columns: ["Company", "Sector", "Price / band", "Subscription window", "Issue size", "Status"],
  },
  {
    path: "/economic-calendar",
    heading: "Economic Calendar",
    columns: ["Date", "Release", "Source", "Reference period"],
  },
  {
    path: "/global-indices",
    heading: "Global Indices",
    columns: ["Index", "Region", "Level", "Change", "Change %"],
  },
  {
    path: "/crypto",
    heading: "Crypto",
    columns: ["Asset", "Price", "Change", "Change %"],
  },
];

/** Console errors this page logs, collected per test. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/vercel\.live/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${e}`));
  return errors;
}

for (const route of ROUTES) {
  test(`${route.path} shows its layout and says plainly that it carries no data`, async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.goto(route.path);

    await expect(
      page.getByRole("heading", { name: route.heading, exact: true, level: 1 }),
    ).toBeVisible({ timeout: 20_000 });

    const main = page.locator("main");
    await expect(main).toContainText("Content pending");
    await expect(main).toContainText("Not connected yet — no rows to show.");

    // The column set is the part of the design that IS decided.
    for (const column of route.columns) {
      await expect(
        page.getByRole("columnheader", { name: column, exact: true }),
      ).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
}

test("no interface-only page renders a data row, or any figure that could read as one", async ({
  page,
}) => {
  for (const route of [...ROUTES.map((r) => r.path), "/mutual-funds"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 });

    /*
     * Exactly one row — the empty state — on the pages that have a
     * table, and no table at all on /mutual-funds. A sample row would
     * show up here immediately.
     */
    const rows = page.locator("main table tbody tr");
    const count = await rows.count();
    expect(count, `${route} body rows`).toBeLessThanOrEqual(1);
    if (count === 1) {
      await expect(rows.first()).toContainText("Not connected yet");
    }

    /*
     * No price-shaped or percentage-shaped figure anywhere in the main
     * content. The copy deliberately contains no numerals of this kind,
     * so any match is a figure that has crept in.
     */
    const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const figures = body.match(/\d[\d,]*\.\d+|\d+(\.\d+)?%|PKR\s*[\d,]/g) ?? [];
    expect(figures, `${route} shows figures: ${figures.join(", ")}`).toEqual([]);
  }
});

test("the interface-only pages carry no control that does nothing", async ({
  page,
}) => {
  for (const route of ROUTES.map((r) => r.path)) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 });

    /*
     * Inside the page body, below the shared chrome: a tab, filter or
     * button here would have nothing to act on. Links out to real
     * pages are fine and are not controls.
     */
    const section = page.locator("main > section");
    await expect(section.locator("button")).toHaveCount(0);
    await expect(section.locator("input, select, textarea")).toHaveCount(0);
  }
});

test("the interface-only pages fit every supported width without sideways scroll", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ROUTES.map((r) => r.path)) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  }
});
