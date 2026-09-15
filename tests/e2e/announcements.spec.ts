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
  // The pager's "Showing N–", which waits out the refetch a page turn starts.
  const shownFrom = async () => {
    const match = /Showing ([\d,]+)–/.exec(await page.locator("main").innerText());
    return match ? Number(match[1].replace(/,/g, "")) : 0;
  };

  /*
   * PSX publishes all day, so nothing here may assume the feed stood
   * still. Both pages are placed against the feed as it is at the end:
   * two reads under URLs the edge cache has never served, so neither can
   * be an older snapshot, stitched on a shared filing so one published
   * between them cannot open a gap. Adjacency does not change as filings
   * arrive on top, which is what lets the checks below be exact.
   */
  const liveFeed = () =>
    page.evaluate(async () => {
      type Row = { id: string; documentUrl: string | null };
      const read = async (offset: number): Promise<Row[]> => {
        const res = await fetch(
          `/api/announcements/latest?count=100&offset=${offset}&fresh=${Date.now()}`,
        );
        return (await res.json()).announcements;
      };
      const head = await read(0);
      const tail = await read(90);
      const seam = tail.findIndex((a) => a.id === head[head.length - 1].id);
      const rows = seam === -1 ? head : [...head, ...tail.slice(seam + 1)];
      return rows.flatMap((a) => (a.documentUrl ? [a.documentUrl] : []));
    });

  await page.goto("/announcements");
  await expect(page.locator(ROWS).first()).toBeVisible();
  const firstPage = await docLinks();
  expect(firstPage.length).toBeGreaterThan(10);

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.locator("main")).toContainText("Page 2");
  // Page 2 starts at 51, or further down if filings arrived since page 1.
  await expect.poll(shownFrom).toBeGreaterThanOrEqual(51);

  const secondPage = await docLinks();
  expect(secondPage.length).toBeGreaterThan(10);
  // Not one filing is repeated across the two pages, however the feed moved.
  expect(secondPage.filter((h) => firstPage.includes(h))).toEqual([]);

  // Previous returns to page 1, which is always the newest filings.
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(page.locator("main")).toContainText("Page 1");
  await expect.poll(shownFrom).toBe(1);
  const restored = await docLinks();

  // Back replays page 2 exactly as it was read.
  await page.goBack();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect.poll(shownFrom).toBeGreaterThanOrEqual(51);
  expect(await docLinks()).toEqual(secondPage);

  const live = await liveFeed();
  const end = live.indexOf(firstPage[firstPage.length - 1]);
  test.skip(end === -1, "Page 1 is no longer among the newest ~190 filings; nothing to place it against");

  // Page 2 is exactly the filings that follow page 1's last: no repeat, no skip.
  expect(secondPage).toEqual(live.slice(end + 1, end + 1 + secondPage.length));

  /*
   * Page 1 on return may have new filings on top, but only ones that
   * have really arrived since it was first read (the live position of
   * its old first filing), and below them the same filings in order.
   */
  const sinceFirstRead = live.indexOf(firstPage[0]);
  if (sinceFirstRead < restored.length) {
    const arrived = restored.indexOf(firstPage[0]);
    expect(arrived).toBeGreaterThanOrEqual(0);
    expect(arrived).toBeLessThanOrEqual(sinceFirstRead);
    expect(restored.slice(arrived)).toEqual(firstPage.slice(0, restored.length - arrived));
  }
});

test("Corporate & Events dropdown and Footer both reach /announcements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Corporate & Events", exact: true }).click();
  await page
    .getByRole("menu", { name: "Corporate & Events", exact: true })
    .getByRole("menuitem", { name: "Company Announcements" })
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

test("GET /api/announcements/latest?after= continues from a filing, wherever it has moved", async ({
  request,
}) => {
  const read = async (query: string) => {
    const response = await request.get(`/api/announcements/latest?${query}`);
    expect(response.status(), query).toBe(200);
    return response.json();
  };
  const ids = (body: { announcements: { id: string }[] }) =>
    body.announcements.map((a) => a.id);

  /*
   * `fresh` is a param the function ignores, so the edge cache has never
   * served that URL and cannot answer with a snapshot from hours ago.
   * The anchored read in between is deliberately left cacheable.
   */
  const head = ids(await read(`count=10&offset=0&fresh=${Date.now()}`));
  const next = await read(`count=10&offset=10&after=${head[9]}`);
  const live = ids(await read(`count=100&offset=0&fresh=${Date.now()}`));

  expect(next.anchored).toBe(true);
  expect(ids(next)).toHaveLength(10);
  const at = live.indexOf(head[9]);
  test.skip(at === -1 || at + 10 >= live.length, "PSX feed moved past one read mid-test");

  // Exactly the ten filings that follow head[9] in the live feed.
  expect(ids(next)).toEqual(live.slice(at + 1, at + 11));
  // `offset` is where they sat when read: at or below the hint, never above the live position.
  expect(next.offset).toBeGreaterThanOrEqual(10);
  expect(next.offset).toBeLessThanOrEqual(at + 1);

  // A filing nowhere near the hint is reported, not passed off as anchored.
  const lost = await read("count=10&offset=10&after=1");
  expect(lost.anchored).toBe(false);
  expect(lost.offset).toBe(10);
  expect(lost.announcements).toHaveLength(10);

  // A bare page carries no anchored flag at all.
  expect("anchored" in (await read("count=10&offset=10"))).toBe(false);

  const malformed = await request.get("/api/announcements/latest?count=10&after=%3Cscript%3E");
  expect(malformed.status()).toBe(400);
});
