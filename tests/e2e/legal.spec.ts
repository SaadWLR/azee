import { expect, test } from "./fixtures";

/*
 * Legal / compliance pages. Desktop-scoped like the other page specs.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Legal pages are viewport-independent; run once on desktop",
  );
});

/** Pages carrying real, approved content ported from azeetrade.com. */
const REAL: [slug: string, heading: string, marker: RegExp][] = [
  ["privacy-policy", "Privacy Policy", /Information We Collect/i],
  ["terms-of-use", "Terms of Use", /Intellectual Property/i],
  [
    "risk-disclosure",
    "Disclaimer & Risk Disclosure",
    /Securities Brokers \(Licensing and Operations\) Regulations, 2016/i,
  ],
  ["regulatory-information", "Regulatory Information", /TREC Holder No\. 108/],
  ["complaints", "Complaints & Escalation", /sdms\.secp\.gov\.pk/],
  ["cookie-policy", "Cookie Policy", /sets no cookies/i],
  ["forms-downloads", "Forms & Downloads", /Know Your Customer/i],
];

/** Pages with no approved source yet — must say so, not improvise. */
const PENDING: [slug: string, heading: string][] = [
  ["aml-kyc", "AML / KYC Policy"],
  ["fee-schedule", "Schedule of Charges"],
];

test("every legal page deep-links and renders its real content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  for (const [slug, heading, marker] of REAL) {
    const response = await page.goto(`/${slug}`);
    expect(response?.status(), slug).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
      slug,
    ).toBeVisible();
    await expect(page.locator("main"), slug).toContainText(marker);
    // Real content, not a stub.
    const words = (await page.locator("main").innerText()).split(/\s+/).length;
    expect(words, `${slug} word count`).toBeGreaterThan(120);
    // A content page must never show the pending state.
    await expect(page.locator("main"), slug).not.toContainText(
      "Content pending",
    );
  }

  expect(errors).toEqual([]);
});

test("pending pages are honest and say exactly what is missing", async ({
  page,
}) => {
  for (const [slug, heading] of PENDING) {
    const response = await page.goto(`/${slug}`);
    expect(response?.status(), slug).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
      slug,
    ).toBeVisible();
    const main = page.locator("main");
    await expect(main, slug).toContainText("Content pending");
    await expect(main, slug).toContainText(
      /published once the following are confirmed/i,
    );
    // It must direct the reader somewhere real rather than dead-ending.
    await expect(main, slug).toContainText("info@azeetrade.com");
  }
});

test("forms page links to real, downloadable PDFs", async ({ page, request }) => {
  await page.goto("/forms-downloads");
  const links = page.locator('main a[href$=".pdf"]');
  expect(await links.count()).toBeGreaterThanOrEqual(10);

  const hrefs = await links.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")!),
  );
  for (const h of hrefs) {
    expect(h).toMatch(/^https:\/\/azeetrade\.com\//);
  }
  // Spot-check that the first one is genuinely a PDF, not a dead link.
  const head = await request.get(hrefs[0]);
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toMatch(/pdf/);
});

test("the three previously-dead footer legal links now resolve", async ({
  page,
}) => {
  for (const [label, path] of [
    ["Privacy Policy", "/privacy-policy"],
    ["Terms of Use", "/terms-of-use"],
    ["Risk Disclosure", "/risk-disclosure"],
  ]) {
    await page.goto("/");
    const link = page.locator("footer").getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", path);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("no footer link addressed by this milestone is still a dead '#'", async ({
  page,
}) => {
  await page.goto("/");
  const dead = await page.locator("footer a[href='#']").evaluateAll((as) =>
    as.map((a) => a.textContent!.trim()),
  );
  for (const label of [
    "Privacy Policy",
    "Terms of Use",
    "Risk Disclosure",
    "Forms & Downloads",
    "Regulatory Information",
    "Complaints & Escalation",
    "AML / KYC Policy",
    "Schedule of Charges",
    "Cookie Policy",
  ]) {
    expect(dead, `${label} should no longer be a dead link`).not.toContain(
      label,
    );
  }
});

test("cookie banner appears, records a choice, and stays dismissed", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.getByRole("dialog", { name: /consent/i });
  await expect(banner).toBeVisible();
  // The claim it makes must match the Cookie Policy.
  await expect(banner).toContainText(/no cookies/i);

  await banner.getByRole("button", { name: "Decline" }).click();
  await expect(banner).not.toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("azee-consent")),
  ).toBe("rejected");

  // Choice persists across navigation.
  await page.goto("/forex");
  await expect(page.getByRole("dialog", { name: /consent/i })).toHaveCount(0);
});
