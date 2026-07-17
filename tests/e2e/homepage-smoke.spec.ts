import { expect, test } from "./fixtures";

/**
 * Smoke: the homepage loads, core chrome renders, and the console is
 * clean. Runs at every configured viewport project.
 */
test("homepage loads with correct title, core sections, and no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");

  await expect(page).toHaveTitle(/AZEE Trade/);
  // The fixed top bar specifically — the footer contains three more
  // labelled <nav> landmarks, so a bare "nav" locator is ambiguous.
  await expect(page.locator("header nav")).toBeVisible();
  await expect(page.locator("h1")).toContainText("Market intelligence.");
  await expect(page.locator("footer")).toContainText(
    "AZEE Securities (Pvt.) Ltd.",
  );

  // Let entrance animations and initial data fetches settle before
  // asserting the console stayed clean.
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
