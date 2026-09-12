import { expect, test } from "./fixtures";
import { shouldRejectParse } from "../../api/announcements/latest";

/*
 * Search and date-range filters on /announcements.
 *
 * Kept in its own file so announcements.spec.ts — the unfiltered
 * behaviour this milestone must not change — stays untouched.
 *
 * Desktop-scoped like the other page specs; the filters are
 * viewport-independent.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Announcement filters are viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";
const SEARCH = "Search announcements";
const UNAVAILABLE = /temporarily unavailable/i;

/** PSX's own filtered total, as rendered by the pager. */
async function pagerTotal(page: import("@playwright/test").Page) {
  const text = await page.locator("main").innerText();
  const match = /of ([\d,]+) announcements/.exec(text);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

test("the search box exists, is labelled, and the date inputs are too", async ({
  page,
}) => {
  await page.goto("/announcements");

  const search = page.getByRole("textbox", { name: SEARCH });
  await expect(search).toBeVisible();
  await expect(search).toHaveAttribute("placeholder", /search/i);

  await expect(page.getByLabel("From date")).toBeVisible();
  await expect(page.getByLabel("To date")).toBeVisible();

  // Nothing to clear until something is filtered.
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});

test("a search updates the URL and narrows PSX's own total", async ({ page }) => {
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  const unfiltered = await pagerTotal(page);
  expect(unfiltered).not.toBeNull();

  await page.getByRole("textbox", { name: SEARCH }).fill("dividend");

  await expect(page).toHaveURL(/[?&]q=dividend/);
  // The filtered total is PSX's, for this query — strictly smaller than
  // the whole corpus, and still a real number.
  await expect
    .poll(async () => await pagerTotal(page), { timeout: 20000 })
    .toBeLessThan(unfiltered!);
  expect(await pagerTotal(page)).toBeGreaterThan(0);
  await expect(page.locator("main")).not.toContainText(UNAVAILABLE);
});

test("a filter resets to page 1", async ({ page }) => {
  await page.goto("/announcements?page=3");
  await expect(page.locator("main")).toContainText("Page 3");

  await page.getByRole("textbox", { name: SEARCH }).fill("board");
  await expect(page).toHaveURL(/[?&]q=board/);
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(page.locator("main")).toContainText("Page 1");
});

test("a nonsense query shows a clean no-results state, not an outage", async ({
  page,
}) => {
  await page.goto("/announcements?q=zzzznotarealquery");

  await expect(page.locator("main")).toContainText(
    "No announcements match these filters.",
  );
  /*
   * The point of the separate state: a real zero-result filter must
   * never borrow the outage copy, and the API must not 503 on it
   * either — PSX returns a valid table with 0 rows and "of 0 entries".
   */
  await expect(page.locator("main")).not.toContainText(UNAVAILABLE);
  await expect(page.locator(ROWS)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear filters" }).first()).toBeVisible();
});

test("a one-sided date range is not sent, and says why", async ({ page }) => {
  await page.goto("/announcements");
  const unfiltered = await pagerTotal(page);

  await page.getByLabel("From date").fill("2026-08-01");
  await expect(page).toHaveURL(/[?&]from=2026-08-01/);

  // PSX ignores a one-sided range, so the UI refuses to pretend.
  await expect(page.locator("main")).toContainText(
    "Add both a start and end date to filter by range.",
  );
  await expect(page.locator("main")).not.toContainText(UNAVAILABLE);
  expect(await pagerTotal(page)).toBe(unfiltered);

  // Completing the range applies it.
  await page.getByLabel("To date").fill("2026-08-07");
  await expect(page).toHaveURL(/[?&]to=2026-08-07/);
  await expect(page.locator("main")).not.toContainText(
    "Add both a start and end date",
  );
  await expect
    .poll(async () => await pagerTotal(page), { timeout: 20000 })
    .toBeLessThan(unfiltered!);
});

test("a filtered URL restores the same view, and back/forward works", async ({
  page,
}) => {
  await page.goto("/announcements?q=dividend&from=2026-08-01&to=2026-08-07");

  await expect(page.getByRole("textbox", { name: SEARCH })).toHaveValue("dividend");
  await expect(page.getByLabel("From date")).toHaveValue("2026-08-01");
  await expect(page.getByLabel("To date")).toHaveValue("2026-08-07");
  await expect(page.locator(ROWS).first()).toBeVisible();
  const filtered = await pagerTotal(page);
  expect(filtered).toBeGreaterThan(0);

  // Every row must fall inside the requested range.
  const dates = await page
    .locator(`${ROWS} td:first-child`)
    .evaluateAll((tds) => tds.map((td) => td.textContent!.trim()));
  for (const d of dates) {
    const day = new Date(`${d} UTC`).toISOString().slice(0, 10);
    expect(day >= "2026-08-01" && day <= "2026-08-07", `row dated ${d}`).toBe(true);
  }

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page.getByRole("textbox", { name: SEARCH })).toHaveValue("");

  await page.goBack();
  await expect(page).toHaveURL(/q=dividend/);
  await expect(page.getByRole("textbox", { name: SEARCH })).toHaveValue("dividend");
  await page.goForward();
  await expect(page.getByRole("textbox", { name: SEARCH })).toHaveValue("");
});

test("typing is debounced: six characters do not fire six requests", async ({
  page,
}) => {
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();

  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/announcements/latest")) calls.push(r.url());
  });

  // Typed faster than the debounce window, so it should commit once.
  await page
    .getByRole("textbox", { name: SEARCH })
    .pressSequentially("profit", { delay: 50 });
  await expect(page).toHaveURL(/[?&]q=profit/);
  await page.waitForTimeout(1500);

  expect(calls.length, `requests fired: ${calls.length}`).toBeLessThanOrEqual(2);
  expect(calls.length).toBeGreaterThan(0);
});

/*
 * The sanity floor, as a unit. It cannot be reached end-to-end: it only
 * fires when PSX's markup changes shape, which is not something a test
 * can ask the live site to do.
 */
test("the parse floor trusts a small result but still catches a partial parse", () => {
  // A genuine small result: PSX's total agrees exactly with what parsed.
  expect(shouldRejectParse(50, 3, 3)).toBe(false);
  expect(shouldRejectParse(50, 0, 0)).toBe(false);
  expect(shouldRejectParse(50, 1, 1)).toBe(false);

  // The case the exact match is for: PSX says 3 exist, only 1 parsed.
  expect(shouldRejectParse(50, 1, 3)).toBe(true);
  expect(shouldRejectParse(50, 0, 223379)).toBe(true);

  // A full page never trips it, and a small `count` is not a failure.
  expect(shouldRejectParse(50, 50, 223379)).toBe(false);
  expect(shouldRejectParse(3, 3, 223379)).toBe(false);

  // No stated total at all: fall back to the flat floor.
  expect(shouldRejectParse(50, 2, null)).toBe(true);
  expect(shouldRejectParse(50, 5, null)).toBe(false);
});
