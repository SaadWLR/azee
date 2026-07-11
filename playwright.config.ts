import { defineConfig } from "@playwright/test";

/*
 * Tests target the deployed production site by default: this project
 * has no local Vercel-functions-in-dev setup (marketService falls
 * back to fixtures under `vite dev`), so production is the only
 * environment where the live data path actually runs. Tradeoff:
 * assertions read real live market data and must allow real-world
 * variance — specs assert plausible ranges and structural truths,
 * never exact live values.
 *
 * Point at a preview deployment instead with:
 *   PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npm run test:e2e
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://azee.vercel.app";

/** Viewports match the widths used in prior milestones' checks. */
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
    name,
    use: { browserName: "chromium" as const, viewport },
  })),
});
