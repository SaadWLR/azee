import { expect, test } from "./fixtures";

/*
 * The /announcements page — PSX company disclosures (type=C).
 * Desktop-scoped like the other page specs; the table is
 * viewport-independent.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "Announcements page is viewport-independent; run once on desktop",
  );
});

const ROWS = "main table tbody tr";

test("announcements page deep-links and lists real PSX disclosures", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const response = await page.goto("/announcements");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { level: 1, name: "Company Announcements" }),
  ).toBeVisible();

  const table = page.locator("main table");
  await expect(table).toBeVisible();
  for (const col of ["Date", "Time", "Symbol", "Company", "Announcement"]) {
    await expect(table.locator("thead")).toContainText(col);
  }

  const rows = page.locator(ROWS);
  expect(await rows.count()).toBeGreaterThanOrEqual(10);

  /*
   * Real rows: a plausible ticker, a non-trivial company name, and a
   * title. Symbols may legitimately be hyphenated (fund tickers such
   * as MCBIM-FUNDS), so the pattern allows that.
   */
  const cells = await rows.evaluateAll((trs) =>
    trs.slice(0, 20).map((tr) => {
      const td = [...tr.querySelectorAll("td")].map((c) => c.textContent!.trim());
      const link = tr.querySelector("td:nth-child(5) a");
      return {
        date: td[0],
        time: td[1],
        symbol: td[2],
        company: td[3],
        title: td[4],
        href: link ? link.getAttribute("href") : null,
      };
    }),
  );
  for (const c of cells) {
    expect(c.symbol, `symbol ${c.symbol}`).toMatch(/^[A-Z0-9][A-Z0-9.-]*$/);
    expect(c.company.length, `company for ${c.symbol}`).toBeGreaterThan(3);
    expect(c.title.length, `title for ${c.symbol}`).toBeGreaterThan(3);
    expect(c.date, `date for ${c.symbol}`).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    expect(c.time, `time for ${c.symbol}`).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  }

  // Documents link to PSX's own originals, never a rehosted copy.
  const linked = cells.filter((c) => c.href);
  expect(linked.length).toBeGreaterThan(0);
  for (const c of linked) {
    expect(c.href).toMatch(
      /^https:\/\/dps\.psx\.com\.pk\/download\/(document|attachment|image)\//,
    );
  }

  // The total is PSX's real figure, not a hardcoded or estimated one.
  const pager = await page.locator("main").innerText();
  expect(pager).toMatch(/Showing 1–\d+ of [\d,]+ announcements/);

  expect(errors).toEqual([]);
});

test("pagination moves to genuinely different, older entries", async ({
  page,
}) => {
  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  const firstPage = await page
    .locator(`${ROWS} td:nth-child(5)`)
    .allInnerTexts();

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.locator("main")).toContainText("Page 2");
  await expect
    .poll(async () => (await page.locator(`${ROWS} td:nth-child(5)`).allInnerTexts())[0])
    .not.toBe(firstPage[0]);

  const secondPage = await page
    .locator(`${ROWS} td:nth-child(5)`)
    .allInnerTexts();
  // No overlap at all between the two pages.
  expect(secondPage.filter((t) => firstPage.includes(t))).toEqual([]);
  await expect(page.locator("main")).toContainText(/Showing 51–/);

  // Back to page 1 restores the original rows.
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(page.locator("main")).toContainText("Page 1");
  expect((await page.locator(`${ROWS} td:nth-child(5)`).allInnerTexts())[0]).toBe(
    firstPage[0],
  );
});

test("Tools dropdown and Footer both reach /announcements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /tools/i }).click();
  await page
    .getByRole("menu", { name: /tools/i })
    .getByRole("menuitem", { name: "Announcements" })
    .click();
  await expect(page).toHaveURL(/\/announcements$/);

  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Markets" })
    .getByRole("link", { name: "Company Announcements" })
    .click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Company Announcements" }),
  ).toBeVisible();
});

test("GET /api/announcements/latest honours count/offset and shape", async ({
  request,
}) => {
  const response = await request.get("/api/announcements/latest?count=10&offset=0");
  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(body.count).toBe(10);
  expect(body.offset).toBe(0);
  expect(Array.isArray(body.announcements)).toBe(true);
  expect(body.announcements.length).toBeLessThanOrEqual(10);
  expect(body.totalAvailable).toBeGreaterThan(1000);
  expect(body.source).toMatch(/^(psx|cache)$/);

  for (const a of body.announcements) {
    expect(typeof a.id).toBe("string");
    expect(a.symbol).toMatch(/^[A-Z0-9][A-Z0-9.-]*$/);
    expect(a.companyName.length).toBeGreaterThan(3);
    expect(a.title.length).toBeGreaterThan(3);
    expect(Number.isNaN(Date.parse(a.announcedAt))).toBe(false);
    if (a.documentUrl) {
      expect(a.documentUrl).toMatch(/^https:\/\/dps\.psx\.com\.pk\/download\//);
      expect(["pdf", "image"]).toContain(a.documentType);
    }
  }

  // A different offset returns different filings.
  const second = await request.get("/api/announcements/latest?count=10&offset=10");
  const other = await second.json();
  const idsA = body.announcements.map((a: { id: string }) => a.id);
  const idsB = other.announcements.map((a: { id: string }) => a.id);
  expect(idsB.filter((i: string) => idsA.includes(i))).toEqual([]);
});
