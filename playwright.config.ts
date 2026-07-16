import { readFileSync } from "node:fs";
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
const PRODUCTION_URL = "https://azee.vercel.app";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? PRODUCTION_URL;

/**
 * Minimal .env loader — Playwright (unlike Vite) does not read .env
 * itself, and a whole dotenv dependency isn't warranted for one
 * secret. Values already in the real environment (CI) always win.
 * The .env file is gitignored; see tests/e2e/README.md.
 */
function loadEnvFile(path = ".env"): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return; // no .env — expected in CI, where vars come from the runner
  }
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

/*
 * The production API sits behind a Vercel WAF rate-limit rule
 * (30 requests / 60s per IP). A Firewall exception lets requests
 * carrying the x-e2e-bypass header with the correct secret skip that
 * rule, so the suite's cumulative volume stops 429-ing its own later
 * tests. The secret lives only in the environment — never in the repo.
 */
const BYPASS_HEADER = "x-e2e-bypass";
const bypassSecret = process.env.E2E_BYPASS_SECRET;

/*
 * Guard: warn loudly rather than fail hard. Failing outright would
 * block legitimate runs against a preview/local URL where the WAF
 * rule doesn't apply; a prominent warning still prevents the
 * confusing "why is everything suddenly 429-ing?" rediscovery this
 * cost us before.
 */
if (!bypassSecret && baseURL === PRODUCTION_URL) {
  console.warn(
    [
      "",
      "  ⚠  E2E_BYPASS_SECRET is not set, and this run targets production.",
      "     Requests will NOT bypass the API rate limit (30 req/60s per IP),",
      "     so later-scheduled tests may fail with 429s that look like real bugs.",
      "     Set it up: see tests/e2e/README.md → “Rate-limit bypass”.",
      "",
    ].join("\n"),
  );
}

/** Viewports match the widths used in prior milestones' checks. */
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

/*
 * Concurrency stays serial with retries. With the bypass header
 * active this is belt-and-braces rather than load-shedding, but it
 * keeps the suite green on the days the secret is missing or the
 * Firewall exception changes, instead of collapsing into a wall of
 * 429s. See the request-dedup and rate-limit milestones for history.
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
    // Applies to page navigations, in-page fetches, and request-context
    // calls alike — i.e. every request the suite makes.
    ...(bypassSecret
      ? { extraHTTPHeaders: { [BYPASS_HEADER]: bypassSecret } }
      : {}),
  },
  projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
    name,
    use: { browserName: "chromium" as const, viewport },
  })),
});
