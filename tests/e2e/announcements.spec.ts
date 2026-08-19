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
  /*
   * Pages are compared by DOCUMENT LINK, not title. Announcement titles
   * are emphatically not unique — routine filings share boilerplate
   * wording across companies ("Financial Results for the Quarter Ended
   * June 30, 2026", the standard "Disclosure of Interest by a
   * Director…" text), so title overlap between pages is normal and
   * proves nothing. PSX's document id is the real per-filing key.
   */
  const docLinks = () =>
    page.locator(`${ROWS} td:nth-child(5) a`).evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")!),
    );

  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  const firstPage = await docLinks();
  expect(firstPage.length).toBeGreaterThan(10);

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.locator("main")).toContainText("Page 2");
  // Turning the page refetches, so wait for the new page's own count.
  await expect(page.locator("main")).toContainText(/Showing 51–/);

  const secondPage = await docLinks();
  expect(secondPage.length).toBeGreaterThan(10);
  // Not one filing is repeated across the two pages.
  expect(secondPage.filter((h) => firstPage.includes(h))).toEqual([]);

  // Back to page 1 restores the original filings.
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(page.locator("main")).toContainText("Page 1");
  await expect(page.locator("main")).toContainText(/Showing 1–/);
  expect((await docLinks())[0]).toBe(firstPage[0]);
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

  /*
   * A different offset returns different filings.
   *
   * Done immediately after the first read, before the small-count loop
   * below, to keep the two paged reads as close together in time as
   * possible — see the shift note further down.
   */
  const second = await request.get("/api/announcements/latest?count=10&offset=10");
  const other = await second.json();
  /*
   * Bracket the pair with a re-read of page 0. PSX's feed is live and
   * newest-first, so a filing landing between two reads pushes every
   * row down and page 1 legitimately serves rows that page 0 held a
   * moment earlier. This third read measures exactly how far the feed
   * moved across the window, so the assertion can account for it
   * instead of failing on correct source behaviour.
   */
  const reread = await request.get("/api/announcements/latest?count=10&offset=0");
  const idsA = body.announcements.map((a: { id: string }) => a.id);
  const idsB = other.announcements.map((a: { id: string }) => a.id);
  const idsReread = (await reread.json()).announcements.map(
    (a: { id: string }) => a.id,
  );

  /*
   * Where page 0's old head sits in the fresh page 0 IS the number of
   * filings that arrived: 0 if nothing moved, k if k landed. It brackets
   * a strictly wider window than the A→B gap, so it is an upper bound on
   * the shift those two reads actually saw.
   */
  const shift = idsReread.indexOf(idsA[0]);
  const overlap = idsB.filter((i: string) => idsA.includes(i));

  if (shift === -1) {
    /*
     * A full page of filings inside a few hundred ms — the window can no
     * longer be reconstructed, so there is nothing sound to assert.
     * Vanishingly rare, and skipping beats inventing a bound.
     */
    test.skip(true, "PSX feed advanced a full page mid-test; window unmeasurable");
  }

  /*
   * With the feed still (the overwhelmingly common case) the pages must
   * be strictly disjoint. Under a shift of k, page 1 has slid up to hold
   * the last k rows page 0 used to end with — so the overlap can be at
   * most k, and must be exactly page 0's tail meeting page 1's head.
   *
   * This still fails loudly if offset were ignored: page 1 would come
   * back as page 0 — ten overlapping ids against a shift of 0 or 1 — and
   * the overlap would sit at the START of page 0, not its tail.
   */
  expect(
    overlap.length,
    `offset=10 overlapped offset=0 by ${overlap.length} ids while the feed moved by only ${shift}`,
  ).toBeLessThanOrEqual(shift);

  if (overlap.length > 0) {
    expect(idsA.slice(idsA.length - overlap.length)).toEqual(overlap);
    expect(idsB.slice(0, overlap.length)).toEqual(overlap);
  }

  /*
   * Small counts must work. A flat sanity floor once made count<5
   * return 503, treating a legitimately short page as a broken parse —
   * the same shape of bug would hit the last page of the corpus.
   */
  for (const count of [1, 3, 5]) {
    const small = await request.get(
      `/api/announcements/latest?count=${count}&offset=0`,
    );
    expect(small.status(), `count=${count}`).toBe(200);
    const smallBody = await small.json();
    expect(smallBody.announcements.length, `count=${count} rows`).toBe(count);
  }
});
