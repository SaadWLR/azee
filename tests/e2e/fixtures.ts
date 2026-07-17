import { test as base, expect } from "@playwright/test";

/**
 * Shared test fixture that attaches the Vercel Firewall rate-limit
 * bypass header to our OWN /api/* requests only.
 *
 * Why not `use.extraHTTPHeaders` in playwright.config: that applies
 * the header to every request the browser makes, including
 * cross-origin ones. A custom header turns those into non-simple
 * requests, so the Google Fonts stylesheet/woff2 fetches get
 * CORS-preflighted and blocked ("Request header field x-e2e-bypass is
 * not allowed by Access-Control-Allow-Headers") — breaking font
 * loading and tripping the suite's clean-console assertions.
 *
 * The WAF rule only matches paths starting with /api/, so scoping the
 * header to those requests is both sufficient and side-effect free.
 * Specs that use the `request` context instead of a browser page (see
 * api-contracts.spec.ts) set the header via test.use() — no page, no
 * fonts, no CORS.
 */
export const test = base.extend<{ rateLimitBypass: void }>({
  rateLimitBypass: [
    async ({ context }, use) => {
      const secret = process.env.E2E_BYPASS_SECRET;
      if (secret) {
        await context.route("**/api/**", async (route) => {
          await route.continue({
            headers: {
              ...route.request().headers(),
              "x-e2e-bypass": secret,
            },
          });
        });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
