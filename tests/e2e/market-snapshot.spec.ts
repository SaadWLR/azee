import { expect, test } from "@playwright/test";

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
