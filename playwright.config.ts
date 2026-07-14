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

/*
 * Concurrency is deliberately serial. The production API is protected
 * by a Vercel WAF rate-limit rule (30 requests / 60s per IP). Running
 * all viewport projects in parallel bursts well past that from a
 * single CI IP and 429s the later-scheduled projects — a test-harness
 * artifact, not a product fault. Serial execution spreads the (already
 * request-deduplicated) calls out under the budget; one retry absorbs
 * any residual 429 near a window boundary. The durable fix is a WAF
 * bypass header for test traffic (a dashboard change); until then this
 * keeps CI green without weakening any assertion. See the request-
 * dedup and rate-limit milestones for the full history.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 2,
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
