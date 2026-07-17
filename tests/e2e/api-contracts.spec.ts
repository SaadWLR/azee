import { expect, test } from "@playwright/test";

/*
 * API-level contract tests via request context — no page loads.
 * Viewport is irrelevant here, so these run in a single project.
 */

/*
 * These hit /api/* directly through the request context, which page
 * routing (tests/e2e/fixtures.ts) does not intercept — so the WAF
 * rate-limit bypass header is set here instead. Safe as
 * extraHTTPHeaders precisely because this spec loads no page: there
 * are no cross-origin font requests to CORS-preflight. Secret comes
 * from the environment only; see tests/e2e/README.md.
 */
test.use({
  extraHTTPHeaders: process.env.E2E_BYPASS_SECRET
    ? { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET }
    : {},
});
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "API contracts are viewport-independent; run once on the desktop project",
  );
});

/**
 * The OLD hardcoded placeholder values removed across M3/M4. Live
 * values could in principle collide with "703.7M shares" someday
 * (same format, different session) — accepted small flake risk in
 * exchange for catching a fixture leak instantly.
 */
const FORBIDDEN_FABRICATIONS = [
  "Commercial Banks",
  "Textile Composite",
  "PKR 38.8B",
  "703.7M shares",
];

test("GET /api/market/snapshot honours the M4 contract", async ({ request }) => {
  const response = await request.get("/api/market/snapshot");
  expect(response.status()).toBe(200);
  const body = await response.json();

  // M4 removed stats from this payload entirely; its reappearance
  // means fabricated rows are being served again.
  expect(body).not.toHaveProperty("stats");

  expect(body.index.name).toBe("KSE-100 Index");
  expect(body.index.value).toBeGreaterThan(100_000);
  expect(body.index.value).toBeLessThan(300_000);
  expect(["OPEN", "CLOSED"]).toContain(body.status);
  expect(["psx", "cache"]).toContain(body.source);

  const raw = JSON.stringify(body);
  for (const forbidden of FORBIDDEN_FABRICATIONS) {
    expect(raw, `snapshot payload must not contain "${forbidden}"`).not.toContain(
      forbidden,
    );
  }
});

test("GET /api/market/watch returns a real market table", async ({ request }) => {
  const response = await request.get("/api/market/watch");
  expect(response.status()).toBe(200);
  const body = await response.json();

  // Mirrors watch.ts's MIN_VALID_ROWS floor: far fewer rows than PSX's
  // listed universe means a broken parse, not a real table.
  expect(body.quotes.length).toBeGreaterThan(50);

  const first = body.quotes[0];
  expect(typeof first.symbol).toBe("string");
  expect(first.price).toBeGreaterThan(0);
  expect(typeof first.changePercent).toBe("number");

  const labels = body.stats.map((s: { label: string }) => s.label);
  expect(labels).toContain("Market Volume");
  expect(labels).toContain("Advancers");
  expect(labels).toContain("Decliners");

  expect(["psx", "cache"]).toContain(body.source);
  expect(typeof body.asOf).toBe("string");

  const raw = JSON.stringify(body);
  for (const forbidden of ["Commercial Banks", "Textile Composite", "PKR 38.8B"]) {
    expect(raw, `watch payload must not contain "${forbidden}"`).not.toContain(
      forbidden,
    );
  }
});
