import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/*
 * The `anchored: false` disclosure.
 *
 * Paging is anchored to the previous page's last filing; when that
 * filing has scrolled beyond the API's reach it falls back to the bare
 * offset page, which can repeat or skip rows — exactly what the
 * anchoring exists to prevent. The API reports that with
 * `anchored: false`, and the page has to SAY so: a silent fallback
 * looks identical to a correct page.
 *
 * The flag cannot be reached from the URL (the anchor rides in history
 * state), and forcing the real API to lose an anchor would mean waiting
 * for PSX to publish ~139 filings. So the response is intercepted and
 * the flag flipped on otherwise-real data, which is the narrowest way
 * to prove the flag reaches the UI.
 *
 * Desktop-scoped like the other functional specs, to manage the suite's
 * known rate-limit thin margin.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Disclosure copy is viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";
const DISCLOSURE = "Showing by position, not by continuation";

/**
 * Serve the real payload with `anchored` forced to `value`. The rate-limit
 * bypass header the fixture adds is re-attached by hand: route.fetch()
 * issues a fresh request rather than replaying the intercepted one.
 */
async function forceAnchored(page: Page, value: boolean | undefined) {
  const secret = process.env.E2E_BYPASS_SECRET;
  await page.route("**/api/announcements/latest*", async (route) => {
    const response = await route.fetch({
      headers: {
        ...route.request().headers(),
        ...(secret ? { "x-e2e-bypass": secret } : {}),
      },
    });
    const body = await response.json();
    await route.fulfill({
      response,
      json: value === undefined ? { ...body, anchored: undefined } : { ...body, anchored: value },
    });
  });
}

test("a page that lost its anchor says the rows are by position", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await forceAnchored(page, false);
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();

  const main = page.locator("main");
  await expect(main).toContainText(DISCLOSURE);
  await expect(main).toContainText(
    "too many filings arrived since the previous page loaded, so a few entries here may repeat or be missing",
  );
  // It sits with the other standing notes under the pager, not as an
  // error state: the rows are real, their continuity is not guaranteed.
  await expect(main.locator("table tbody tr").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("an anchored page, and a first page with no anchor at all, stay quiet", async ({
  page,
}) => {
  // The control: the same fixture with the flag as the API really sends
  // it. Without this, the test above would pass on a page that shows the
  // line unconditionally.
  await forceAnchored(page, true);
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(DISCLOSURE);

  // Page 1 carries no anchor, so the API omits the field entirely.
  await page.unroute("**/api/announcements/latest*");
  await forceAnchored(page, undefined);
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(DISCLOSURE);
});
