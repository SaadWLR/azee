import { expect, test } from "./fixtures";

/*
 * The company / trust routes: /about, /contact, /get-started, and the
 * catch-all 404.
 *
 * Desktop-scoped like the other page specs — this content is
 * viewport-independent, and the suite keeps its API footprint low.
 *
 * These pages exist to be TRUSTED, so the assertions check that the
 * real sourced facts are actually rendered, not merely that a page
 * loaded. Every value asserted here is transcribed from azeetrade.com
 * into src/data/company.ts.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Trust-page content is viewport-independent; run once on desktop",
  );
});

/** Copy that was removed site-wide and must never come back. */
const FRAUD_WARNING = /Beware of Fraudulent/i;

test("/about renders the real corporate record and the founder's message", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "AZEE Securities (Pvt.) Ltd." }),
  ).toBeVisible();

  const main = page.locator("main");

  // Incorporation and licensing, as published.
  await expect(main).toContainText("K-8159 (2000-1)");
  await expect(main).toContainText("108/Securities Broker/2019");
  await expect(main).toContainText("Securities Act, 2015");

  // The four participant/registration identifiers.
  for (const id of ["108", "0041920", "04184", "C0418401"]) {
    await expect(main).toContainText(id);
  }

  // The founder's message is attributed, not anonymous boilerplate.
  await expect(main).toContainText("Mr. Amir Zia");
  await expect(main).toContainText("Founder and CEO");
  await expect(main).toContainText(/ethics and transparency/i);

  // Memberships include both exchanges and both participant roles.
  for (const body of [
    "Pakistan Stock Exchange",
    "Pakistan Mercantile Exchange",
    "Central Depository Company",
    "National Clearing Company",
  ]) {
    await expect(main).toContainText(body);
  }

  // Removed site-wide; must not reappear via ported copy.
  await expect(main).not.toContainText(FRAUD_WARNING);

  expect(errors).toEqual([]);
});

test("/contact lists both head offices and all six branches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const response = await page.goto("/contact");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Get in touch" }),
  ).toBeVisible();

  const main = page.locator("main");

  // Head offices, by their distinguishing address lines.
  await expect(main).toContainText("Room # 33");
  await expect(main).toContainText("Stock Exchange Road");
  await expect(main).toContainText("Suite # 705");
  await expect(main).toContainText("I.I. Chundrigar Road");

  // All six branches, each by name.
  for (const branch of [
    "Gulshan-e-Iqbal Branch",
    "Clifton Branch",
    "North Nazimabad Branch",
    "Malir Cantt Branch",
    "Lahore Branch",
    "Rawalpindi Branch",
  ]) {
    await expect(main).toContainText(branch);
  }

  // A sample of real branch detail — proves addresses render, not just
  // headings.
  await expect(main).toContainText("Siddique Trade Center");
  await expect(main).toContainText("Hamilton Court");

  // The UAN is a real tel: link, and both mailboxes are present.
  await expect(
    main.locator('a[href="tel:+923092474783"]').first(),
  ).toBeVisible();
  await expect(main).toContainText("info@azeetrade.com");
  await expect(main).toContainText("support@azeetrade.com");

  await expect(main).not.toContainText(FRAUD_WARNING);
  expect(errors).toEqual([]);
});

test("the /contact form is honestly client-only — mailto, no backend", async ({
  page,
}) => {
  await page.goto("/contact");
  const main = page.locator("main");

  // It says what it does, before you use it.
  await expect(main).toContainText(/opens a pre-filled message in your own email app/i);
  await expect(main).toContainText(/nothing is submitted to this website/i);

  // There is no <form> posting anywhere — the whole point.
  expect(await page.locator("main form").count()).toBe(0);

  const submit = page.getByRole("link", { name: /open in your email app/i });
  // Disabled until there is a message to send.
  await expect(submit).toHaveAttribute("aria-disabled", "true");

  await page.getByPlaceholder("How can we help?").fill("Test enquiry body");
  await page.getByPlaceholder("Subject").fill("Test subject");

  // Now it carries a real mailto: with the typed content encoded in.
  const href = await submit.getAttribute("href");
  expect(href).toContain("mailto:info@azeetrade.com");
  expect(href).toContain("Test%20subject");
  expect(href).toContain("Test%20enquiry%20body");
});

test("/get-started is an honest interim page, not a fake signup", async ({
  page,
}) => {
  const response = await page.goto("/get-started");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: /Open an account with AZEE/i }),
  ).toBeVisible();

  const main = page.locator("main");

  // States plainly that onboarding is not built.
  await expect(main).toContainText(/coming soon/i);
  await expect(main).toContainText(/still being built/i);

  // And gives routes that genuinely work today.
  await expect(main.locator('a[href="tel:+923092474783"]').first()).toBeVisible();
  await expect(
    main.locator('a[href="mailto:info@azeetrade.com"]').first(),
  ).toBeVisible();

  /*
   * No mocked-up application: a licensed broker must not show a
   * document-upload or account-opening form that cannot submit.
   */
  expect(await page.locator("main form").count()).toBe(0);
  expect(await page.locator('main input[type="file"]').count()).toBe(0);
  await expect(main).not.toContainText(FRAUD_WARNING);
});

test("an unknown path renders the 404 page, noindexed, with a way out", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/this-path-does-not-exist-9f3a");
  await expect(
    page.getByRole("heading", { level: 1, name: /can't find that page/i }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Error 404");

  /*
   * The host serves the SPA shell with HTTP 200 for every path, so the
   * robots meta tag is the only thing telling a crawler this is not a
   * real page. Assert it is actually in the DOM.
   */
  await expect
    .poll(async () =>
      page.locator('meta[name="robots"]').getAttribute("content"),
    )
    .toBe("noindex");

  // The site's own navigation is still available — the fastest way out.
  await expect(page.locator("header nav")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();

  // And an explicit route home that actually works.
  await page.getByRole("link", { name: /back to the homepage/i }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors).toEqual([]);
});

test("the noindex tag does not leak onto real pages after a 404", async ({
  page,
}) => {
  // Regression guard for the SPA hazard: a meta tag added on one route
  // must be removed when the visitor navigates on, or it would quietly
  // de-index a real page.
  await page.goto("/this-path-does-not-exist-9f3a");
  await expect
    .poll(async () =>
      page.locator('meta[name="robots"]').getAttribute("content"),
    )
    .toBe("noindex");

  await page.getByRole("link", { name: /back to the homepage/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => page.locator('meta[name="robots"]').count()).toBe(0);
});

test("Navbar Client Login and the homepage CTAs all reach real routes", async ({
  page,
}) => {
  await page.goto("/");

  // No dead placeholder anchors left in the header.
  expect(await page.locator('header a[href="#"]').count()).toBe(0);

  // Desktop Client Login goes to the interim page.
  const login = page.locator("header").getByRole("link", { name: "Client Login" });
  await expect(login).toHaveAttribute("href", "/get-started");

  // The hero's primary CTA too.
  const hero = page.getByRole("link", { name: "Open a Trading Account" }).first();
  await expect(hero).toHaveAttribute("href", "/get-started");
  await hero.click();
  await expect(page).toHaveURL(/\/get-started$/);
});

test("Footer Company column reaches About, Contact and Open an Account", async ({
  page,
}) => {
  await page.goto("/");
  const company = page.getByRole("navigation", { name: "Company" });

  await expect(
    company.getByRole("link", { name: "About AZEE", exact: true }),
  ).toHaveAttribute("href", "/about");
  await expect(
    company.getByRole("link", { name: "Contact Us", exact: true }),
  ).toHaveAttribute("href", "/contact");
  await expect(
    company.getByRole("link", { name: "Open an Account", exact: true }),
  ).toHaveAttribute("href", "/get-started");

  await company.getByRole("link", { name: "About AZEE", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
});
