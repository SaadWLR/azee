import { expect, test } from "./fixtures";

/** The snapshot card inside the hero (Research also uses this glass class). */
const PANEL = "#markets .liquid-glass-strong";

test.describe("PSX Market Snapshot panel", () => {
  test("renders a plausible live KSE-100 value and live session stats", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = page.locator(PANEL);
    await expect(panel).toContainText("KSE-100 Index");

    // The value counts up from 0 on entrance, so poll until it settles
    // in a sane live range. Range, not exact value: this is real
    // market data (fixture leakage would show 187,454.64 only by
    // colliding with the live index — the API-contract spec pins the
    // fixture check exactly).
    await expect
      .poll(
        async () => {
          const text = await panel.locator(".tabular-nums").first().innerText();
          return Number.parseFloat(text.replace(/,/g, ""));
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(100_000);
    const value = Number.parseFloat(
      (await panel.locator(".tabular-nums").first().innerText()).replace(/,/g, ""),
    );
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeLessThan(300_000);

    // Live session stats composed from /api/market/watch.
    await expect(panel).toContainText("Market Volume");
    await expect(panel).toContainText("Advancers");
    await expect(panel).toContainText("Decliners");
  });

  test("renders the other PSX benchmark indices with live values", async ({
    page,
  }) => {
    /*
     * Read the exact payload the panel rendered: the snapshot and the
     * strip share one deduplicated /api/market/indices request, so its
     * response is the panel's data. A separate request could land on a
     * different edge-cache entry than the page's.
     */
    const feeds: {
      indices: { name: string }[];
      missing?: { name: string }[];
    }[] = [];
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname !== "/api/market/indices") return;
      if (response.ok()) feeds.push(await response.json());
    });

    await page.goto("/");
    const panel = page.locator(PANEL);
    await expect(panel).toContainText("KSE-100 Index");
    await expect.poll(() => feeds.length, { timeout: 10_000 }).toBeGreaterThan(0);
    // The latest one, should a 75s poll have landed in the meantime.
    const { indices, missing = [] } = feeds[feeds.length - 1];
    const returned = new Set(indices.map((index) => index.name));
    const reportedMissing = new Set(missing.map((index) => index.name));

    // The multi-index strip (KSE-100 is the panel's hero, so it is not
    // repeated here).
    await expect(panel).toContainText("Other Indices");
    const strip = panel
      .getByText("Other Indices", { exact: true })
      .locator("xpath=..");

    /*
     * Every other benchmark index is either a row or named as
     * temporarily unavailable. PSX does fail single index reads: on
     * 2026-09-21 a preview's edge cache served four of five for half an
     * hour after one failed read. A gap the API reports in `missing` is
     * tolerated. One it drops silently, or a row the panel drops from a
     * feed that carried it, still fails.
     */
    for (const name of ["KSE-30", "KSE All Share", "KMI-30", "KMI All Share"]) {
      if (returned.has(name)) {
        // Exact match: a row's label is the bare name, whereas the
        // unavailable note only mentions it inside a sentence.
        await expect(strip.getByText(name, { exact: true })).toBeVisible();
      } else {
        expect(
          reportedMissing.has(name),
          `"${name}" is neither in the feed nor reported missing by it`,
        ).toBe(true);
        await expect(strip.getByText(name, { exact: true })).toHaveCount(0);
        await expect(strip).toContainText(
          new RegExp(`${name}[^.]* temporarily unavailable\\.`),
        );
        test.info().annotations.push({
          type: "missing index",
          description: `the feed reported ${name} missing; the panel said so`,
        });
      }
    }

    // Read the first row's value (the leading number, before the change
    // arrow). Real data → assert a sane range, not an exact value.
    if (indices.some((index) => index.name !== "KSE-100")) {
      await expect
        .poll(
          async () => {
            const txt = await strip.locator("p.tabular-nums").first().innerText();
            const m = txt.replace(/,/g, "").match(/^[\d.]+/);
            return m ? Number.parseFloat(m[0]) : 0;
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThan(1000);
    }

    // KSE-100 is the hero value and is never duplicated into the strip.
    expect(await strip.innerText()).not.toContain("KSE-100");
  });

  test("contains no fabricated placeholder stats (M4 regression guard)", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = page.locator(PANEL);
    await expect(panel).toContainText("KSE-100 Index");

    /*
     * THE key regression assertion of this suite. Until M4 the panel
     * showed hardcoded placeholder rows (Market Value, sector
     * gainers/losers, IPOs) that were not derivable from any live
     * source — fabricated data on a brokerage site. If any of these
     * labels ever reappear as a stat row (an M4 revert, a fixture
     * leaking into production, or a new hardcoded row), this fails
     * immediately.
     *
     * Scoped to the stats region — everything above the "Latest News"
     * block — because the panel now also renders live news headlines,
     * which can legitimately contain market terms like "IPOs" or "Top
     * Loser" (they are real Business Recorder article titles, not
     * fabricated stat rows). Checking the whole panel would
     * false-positive on genuine news.
     */
    const fullText = await panel.innerText();
    const statsRegion = fullText.split("Latest News")[0];
    for (const forbidden of [
      "Market Value",
      "Top Gaining Sector",
      "Top Loser",
      "IPOs",
      "Symbols Traded",
    ]) {
      expect(
        statsRegion,
        `stats region must not contain fabricated stat "${forbidden}"`,
      ).not.toContain(forbidden);
    }
  });
});
