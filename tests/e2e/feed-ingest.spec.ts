import { expect, test, type APIRequestContext } from "@playwright/test";

/*
 * Office-feed ingest and feed-first read on /api/market/watch
 * (api/market/psx-watch.ts, wire format src/types/feed.ts).
 *
 * PREVIEW DEPLOYMENTS ONLY. This spec writes snapshots, so it refuses
 * to run against production twice over: the base URL must not be the
 * production host, and the deployment must report the "preview" KV
 * namespace (X-Feed-Namespace, set by the function from VERCEL_ENV)
 * before any credential is sent. Without its env it skips, so a normal
 * suite run against production is unaffected.
 *
 *   FEED_TEST_INGEST_SECRET  the PREVIEW value of FEED_INGEST_SECRET
 *   FEED_TEST_KV_URL / FEED_TEST_KV_TOKEN
 *                            KV REST credentials, used only to delete
 *                            this spec's "preview:" keys before and after
 *   FEED_TEST_UNSET_BASE_URL optional: a preview deployed with
 *                            FEED_INGEST_SECRET unset
 *   FEED_TEST_UNSET_BYPASS   that preview's protection-bypass value, sent
 *                            as a header to that host only
 *
 * Every quote below is SYNTHETIC — "ZZSYN" symbols, labelled in their
 * name — and exists only in the preview namespace for the run.
 */

const PRODUCTION_HOSTS = ["azee.vercel.app"];
const PREVIEW_KEYS = ["preview:feed:market-watch", "preview:feed:market-watch:meta"];
const SYNTHETIC_NAME = "SYNTHETIC TEST FIXTURE - not market data";

const secret = process.env.FEED_TEST_INGEST_SECRET;
const kvUrl = process.env.FEED_TEST_KV_URL;
const kvToken = process.env.FEED_TEST_KV_TOKEN;
const unsetBaseUrl = process.env.FEED_TEST_UNSET_BASE_URL;
const unsetBypass = process.env.FEED_TEST_UNSET_BYPASS;

test.describe.configure({ mode: "serial" });
test.use({
  extraHTTPHeaders: process.env.E2E_BYPASS_SECRET
    ? { "x-e2e-bypass": process.env.E2E_BYPASS_SECRET }
    : {},
});

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "API-level; run once on the desktop project",
  );
  test.skip(
    !secret || !kvUrl || !kvToken,
    "feed ingest spec needs FEED_TEST_INGEST_SECRET and FEED_TEST_KV_* (preview only)",
  );
});

/** Deletes this spec's keys — and refuses any key outside the preview namespace. */
async function deletePreviewKeys() {
  for (const key of PREVIEW_KEYS) {
    if (!key.startsWith("preview:")) throw new Error(`refusing to delete ${key}`);
    const response = await fetch(`${kvUrl}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (!response.ok) throw new Error(`KV delete responded ${response.status}`);
  }
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function board(symbols: number, extra: Record<string, unknown> = {}) {
  return {
    schema: 1,
    kind: "market-watch",
    asOf: iso(-60_000),
    sentAt: iso(0),
    complete: true,
    quotes: Array.from({ length: symbols }, (_, i) => ({
      symbol: `ZZSYN${String(i).padStart(3, "0")}`,
      name: SYNTHETIC_NAME,
      price: 100 + i,
      changePercent: i % 3 === 0 ? 1.5 : -0.5,
      changePoints: 1,
      volume: 1000 + i,
    })),
    ...extra,
  };
}

let probe = 0;
/** GET through a fresh cache key, so the edge never answers from an earlier read. */
async function readWatch(request: APIRequestContext) {
  const response = await request.get(`/api/market/watch?feedprobe=${Date.now()}-${probe++}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}

function post(
  request: APIRequestContext,
  data: unknown,
  auth?: string,
  extraHeaders: Record<string, string> = {},
  baseURL = "",
) {
  return request.post(`${baseURL}/api/market/watch`, {
    data: data as object,
    headers: { ...extraHeaders, ...(auth === undefined ? {} : { Authorization: auth }) },
  });
}

const AUTH = () => `Bearer ${secret}`;

test.beforeAll(async ({ request, baseURL }) => {
  if (!secret || !kvUrl || !kvToken) return;
  const host = new URL(baseURL ?? "").host;
  if (PRODUCTION_HOSTS.includes(host)) {
    throw new Error(`feed-ingest.spec refuses to run against production (${host})`);
  }
  // Unauthenticated, so nothing can be written even if the check fails.
  const response = await post(request, {});
  expect(response.status(), "an unauthenticated POST is refused").toBe(401);
  expect(
    response.headers()["x-feed-namespace"],
    "the deployment must write to the preview KV namespace",
  ).toBe("preview");
  await deletePreviewKeys();
});

test.afterAll(async () => {
  if (!secret || !kvUrl || !kvToken) return;
  await deletePreviewKeys();
});

test("with no feed stored, GET is the portal path", async ({ request }) => {
  const { body } = await readWatch(request);
  expect(body?.source).not.toBe("feed");
});

test("POST without Authorization is 401", async ({ request }) => {
  const response = await post(request, board(100));
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toBe("Bearer");
});

test("POST with a wrong key is 401", async ({ request }) => {
  for (const auth of ["Bearer wrong", `${AUTH()}x`, `Basic ${secret}`, "Bearer ", ""]) {
    const response = await post(request, board(100), auth);
    expect(response.status(), "a wrong credential is refused").toBe(401);
  }
});

test("non-POST writes are 405", async ({ request }) => {
  for (const method of ["PUT", "DELETE", "PATCH"] as const) {
    const response = await request.fetch("/api/market/watch", {
      method,
      data: board(100),
      headers: { Authorization: AUTH() },
    });
    expect(response.status(), `${method} is not a write path`).toBe(405);
  }
  const etfs = await request.post("/api/market/etfs", {
    data: board(100),
    headers: { Authorization: AUTH() },
  });
  expect(etfs.status(), "the ETF view takes no writes").toBe(405);
});

let accepted: ReturnType<typeof board>;

test("a valid snapshot is accepted and served with source feed", async ({ request }) => {
  accepted = board(100, { asOf: iso(-10 * 60_000), marketStatus: "open" });
  const response = await post(request, accepted, AUTH());
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ accepted: true, symbols: 100 });

  const { status, body } = await readWatch(request);
  expect(status).toBe(200);
  expect(body.source).toBe("feed");
  expect(body.asOf).toBe(accepted.asOf);
  expect(body.quotes).toHaveLength(100);
  expect(body.quotes[0]).toMatchObject({ symbol: "ZZSYN000", name: SYNTHETIC_NAME });
  // Open and ten minutes old: stale.
  expect(body.stale).toBe(true);
});

const tooLarge = () => ({ ...board(100), padding: "x".repeat(1_100_000) });
const withQuote = (patch: Record<string, unknown>) => {
  const b = board(100);
  Object.assign(b.quotes[5], patch);
  return b;
};

const REJECTIONS: [reason: string, make: () => unknown, label?: string][] = [
  ["bad_schema", () => board(100, { schema: 2 })],
  ["bad_kind", () => board(100, { kind: "indices" })],
  ["incomplete", () => board(100, { complete: false })],
  ["bad_asof", () => board(100, { asOf: "2026-10-15T14:00:00" })],
  ["asof_in_future", () => board(100, { asOf: iso(5 * 60_000) })],
  ["bad_sent_at", () => board(100, { sentAt: "soon" })],
  ["bad_market_status", () => board(100, { marketStatus: "OPEN" })],
  ["no_quotes", () => board(100, { quotes: [] })],
  ["bad_symbol", () => withQuote({ symbol: "abc" })],
  ["bad_number", () => withQuote({ price: 0 }), "price 0"],
  ["bad_number", () => withQuote({ volume: -1 }), "negative volume"],
  ["bad_number", () => withQuote({ open: -5 }), "negative open"],
  ["duplicate_symbol", () => withQuote({ symbol: "ZZSYN000" })],
  ["bad_breadth", () => board(100, { breadth: { advancers: -1 } })],
  ["bad_stats", () => board(100, { stats: [{ label: "x" }] })],
  ["body_too_large", tooLarge],
  ["out_of_order", () => board(100, { asOf: iso(-20 * 60_000) })],
];

for (const [reason, make, label] of REJECTIONS) {
  test(`rejects ${reason}${label ? ` (${label})` : ""} and leaves the snapshot unchanged`, async ({ request }) => {
    const response = await post(request, make(), AUTH());
    expect(response.status()).toBe(400);
    expect((await response.json()).reason).toBe(reason);
    const { body } = await readWatch(request);
    expect(body.source).toBe("feed");
    expect(body.asOf).toBe(accepted.asOf);
    expect(body.quotes).toHaveLength(100);
  });
}

test("rejects a body that is not JSON", async ({ request }) => {
  const response = await request.post("/api/market/watch", {
    data: "{not json",
    headers: { Authorization: AUTH(), "Content-Type": "application/json" },
  });
  expect(response.status()).toBe(400);
  const { body } = await readWatch(request);
  expect(body.asOf).toBe(accepted.asOf);
});

test("stale is claimed only when the feed says the market is open", async ({ request }) => {
  const closed = board(100, { asOf: iso(-9 * 60_000), marketStatus: "closed" });
  expect((await post(request, closed, AUTH())).status()).toBe(200);
  let { body } = await readWatch(request);
  expect(body.asOf).toBe(closed.asOf);
  expect(body).not.toHaveProperty("stale");

  const silent = board(100, { asOf: iso(-8 * 60_000) });
  expect((await post(request, silent, AUTH())).status()).toBe(200);
  ({ body } = await readWatch(request));
  expect(body.asOf).toBe(silent.asOf);
  expect(body).not.toHaveProperty("stale");

  const unknown = board(100, { asOf: iso(-7 * 60_000), marketStatus: "unknown" });
  expect((await post(request, unknown, AUTH())).status()).toBe(200);
  ({ body } = await readWatch(request));
  expect(body.asOf).toBe(unknown.asOf);
  expect(body).not.toHaveProperty("stale");

  accepted = board(100, { asOf: iso(-30_000), marketStatus: "open" });
  expect((await post(request, accepted, AUTH())).status()).toBe(200);
  ({ body } = await readWatch(request));
  expect(body.asOf).toBe(accepted.asOf);
  expect(body.stale).toBe(false);
});

test("the partial-read guard rejects below 80% of the previous board", async ({ request }) => {
  const short = await post(request, board(79, { asOf: iso(-20_000) }), AUTH());
  expect(short.status()).toBe(400);
  expect((await short.json()).reason).toBe("partial_snapshot");
  let { body } = await readWatch(request);
  expect(body.asOf).toBe(accepted.asOf);
  expect(body.quotes).toHaveLength(100);

  const enough = board(80, { asOf: iso(-10_000) });
  expect((await post(request, enough, AUTH())).status()).toBe(200);
  ({ body } = await readWatch(request));
  expect(body.asOf).toBe(enough.asOf);
  expect(body.quotes).toHaveLength(80);
});

test("a deployment with FEED_INGEST_SECRET unset can never write", async ({ request }) => {
  test.skip(!unsetBaseUrl, "needs FEED_TEST_UNSET_BASE_URL");
  const before = await readWatch(request);
  const attempt = board(100, { asOf: iso(0), marketStatus: "open" });
  for (const auth of [AUTH(), "Bearer ", "Bearer undefined"]) {
    const response = await post(
      request,
      attempt,
      auth,
      unsetBypass ? { "x-vercel-protection-bypass": unsetBypass } : {},
      unsetBaseUrl,
    );
    expect(response.headers()["x-feed-namespace"]).toBe("preview");
    expect(response.status()).toBe(401);
  }
  const after = await readWatch(request);
  expect(after.body.asOf).toBe(before.body.asOf);
});
