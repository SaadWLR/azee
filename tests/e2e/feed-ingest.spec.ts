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
 *   FEED_TEST_EXTRA_PRODUCTION_HOSTS
 *                            optional, comma-separated: more hosts to
 *                            refuse, on top of the defaults below
 *
 * Every quote below is SYNTHETIC — "ZZSYN" symbols, labelled in their
 * name — and exists only in the preview namespace for the run.
 */

/*
 * Hosts this spec must never write to. The defaults are the production
 * alias and the public domain; FEED_TEST_EXTRA_PRODUCTION_HOSTS
 * (comma-separated) adds any others. This is the first guard; the
 * preview-namespace check in beforeAll is the second, and still runs.
 */
const PRODUCTION_HOSTS = [
  "azee.vercel.app",
  "azeetrade.com",
  "www.azeetrade.com",
  ...(process.env.FEED_TEST_EXTRA_PRODUCTION_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
];
const PREVIEW_KEYS = [
  "preview:feed:market-watch",
  "preview:feed:market-watch:meta",
  "preview:feed:indices",
  "preview:feed:etfs",
];
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
  const host = new URL(baseURL ?? "").hostname.toLowerCase();
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

/*
 * The partial-read guard compares counts within one PKT trading day only.
 * These run on a clean store and use fixed timestamps two PKT days back,
 * so they never collide with the "now"-relative snapshots above. The
 * boundary pair is 23:59 and 00:01 PKT, and the first day is written in
 * Z form on purpose: 00:01 PKT is 19:01Z on the PREVIOUS UTC date, so a
 * guard keyed on the UTC date would treat it as the same day.
 */
const PKT_MS = 5 * 60 * 60 * 1000;
const pktDay = (offsetDays: number) =>
  new Date(Date.now() + PKT_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);
const DAY_1 = pktDay(-2);
const DAY_2 = pktDay(-1);

test.describe("partial-read guard across the PKT day boundary", () => {
  test.beforeAll(async () => {
    if (!secret || !kvUrl || !kvToken) return;
    await deletePreviewKeys();
  });

  test("23:59 is still day 1: a drop below 80% is rejected partial_snapshot", async ({ request }) => {
    // 23:57 and 23:59 PKT on DAY_1, written as 18:57Z and +05:00.
    const evening = board(100, { asOf: `${DAY_1}T18:57:00Z` });
    expect((await post(request, evening, AUTH())).status()).toBe(200);

    const late = await post(request, board(79, { asOf: `${DAY_1}T23:59:00+05:00` }), AUTH());
    expect(late.status()).toBe(400);
    expect((await late.json()).reason).toBe("partial_snapshot");
    const { body } = await readWatch(request);
    expect(body.asOf).toBe(evening.asOf);
    expect(body.quotes).toHaveLength(100);
  });

  test("00:01 is day 2: a board far below 80% of the prior day's is accepted", async ({ request }) => {
    // 00:01 PKT on DAY_2 is 19:01Z on DAY_1, the same UTC date as above.
    const morning = board(10, { asOf: `${DAY_1}T19:01:00Z` });
    const response = await post(request, morning, AUTH());
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true, symbols: 10 });
    const { body } = await readWatch(request);
    expect(body.asOf).toBe(morning.asOf);
    expect(body.quotes).toHaveLength(10);
  });

  test("within day 2 the guard applies again, against the day's first board", async ({ request }) => {
    const short = await post(request, board(7, { asOf: `${DAY_2}T00:02:00+05:00` }), AUTH());
    expect(short.status()).toBe(400);
    expect((await short.json()).reason).toBe("partial_snapshot");

    const enough = board(8, { asOf: `${DAY_2}T00:03:00+05:00` });
    expect((await post(request, enough, AUTH())).status()).toBe(200);
    const { body } = await readWatch(request);
    expect(body.asOf).toBe(enough.asOf);
  });

  test("an older asOf is still out_of_order, same day or the day before", async ({ request }) => {
    for (const asOf of [`${DAY_2}T00:01:30+05:00`, `${DAY_1}T23:59:00+05:00`]) {
      const response = await post(request, board(100, { asOf }), AUTH());
      expect(response.status(), asOf).toBe(400);
      expect((await response.json()).reason, asOf).toBe("out_of_order");
    }
    const { body } = await readWatch(request);
    expect(body.asOf).toBe(`${DAY_2}T00:03:00+05:00`);
    expect(body.quotes).toHaveLength(8);
  });
});

/*
 * Benchmark indices and ETFs on the same message (optional, additive to
 * schema 1). Served feed-first by /api/market/indices and
 * /api/market/etfs; written in the same MSET as the board. Clean store,
 * "now"-relative timestamps, all fixtures SYNTHETIC.
 */
const BENCHMARKS = ["KSE100", "KSE30", "ALLSHR", "KMI30", "KMIALLSHR"];

function index(code: string, changePoints: number, asOf: string) {
  return {
    code,
    name: `SYNTHETIC ${code}`,
    value: 100_000 + changePoints,
    changePoints,
    changePercent: changePoints / 1000,
    direction: changePoints >= 0 ? "up" : "down",
    asOf,
  };
}

function etf(i: number, changePoints: number, volume: number) {
  return {
    symbol: `ZZSYNETF${i}`,
    name: SYNTHETIC_NAME,
    price: 10 + i,
    ldcp: 10 + i - changePoints,
    high: 11 + i,
    low: 9 + i,
    changePoints,
    changePercent: 1,
    direction: changePoints >= 0 ? "up" : "down",
    volume,
  };
}

async function readJson(request: APIRequestContext, path: string) {
  const response = await request.get(`${path}?feedprobe=${Date.now()}-${probe++}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}
const readIndices = (request: APIRequestContext) => readJson(request, "/api/market/indices");
const readEtfs = (request: APIRequestContext) => readJson(request, "/api/market/etfs");

test.describe("indices and ETFs on the feed message", () => {
  let message: ReturnType<typeof board> & { indices: ReturnType<typeof index>[] };

  test.beforeAll(async () => {
    if (!secret || !kvUrl || !kvToken) return;
    await deletePreviewKeys();
  });

  test("with no feed sections stored, indices and ETFs are the portal path", async ({ request }) => {
    expect((await readIndices(request)).body?.source).not.toBe("feed");
    expect((await readEtfs(request)).body?.source).not.toBe("feed");
  });

  test("one message carrying all three is served feed-first by all three endpoints", async ({ request }) => {
    const indices = [
      index("KMI30", -5, iso(-10 * 60_000)),
      index("KSE100", 12, iso(-11 * 60_000)),
      index("ALLSHR", 0, iso(-12 * 60_000)),
    ];
    message = {
      ...board(100, {
        asOf: iso(-10 * 60_000),
        marketStatus: "open",
        etfs: [etf(1, 0.5, 100), etf(2, -0.2, 300), etf(3, 0.1, 200)],
      }),
      indices,
    };
    const response = await post(request, message, AUTH());
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true, symbols: 100, indices: 3, etfs: 3 });

    const watch = await readWatch(request);
    expect(watch.body.source).toBe("feed");
    expect(watch.body.asOf).toBe(message.asOf);
    expect(watch.body).not.toHaveProperty("indices");
    expect(watch.body).not.toHaveProperty("etfs");

    const { status, body } = await readIndices(request);
    expect(status).toBe(200);
    expect(body.source).toBe("feed");
    // Display order, canonical names, and every benchmark in exactly one list.
    expect(body.indices.map((i: { code: string }) => i.code)).toEqual(["KSE100", "ALLSHR", "KMI30"]);
    expect(body.indices[0].name).toBe("KSE-100");
    expect(body.missing).toEqual([
      { code: "KSE30", name: "KSE-30" },
      { code: "KMIALLSHR", name: "KMI All Share" },
    ]);
    expect(
      [...body.indices, ...body.missing].map((i: { code: string }) => i.code).sort(),
    ).toEqual([...BENCHMARKS].sort());
    expect(Date.parse(body.asOf)).toBe(Date.parse(indices[0].asOf));
    expect(body.status).toBe("OPEN");
    expect(body.stale).toBe(true);

    const etfs = await readEtfs(request);
    expect(etfs.status).toBe(200);
    expect(etfs.body.source).toBe("feed");
    expect(etfs.body.asOf).toBe(message.asOf);
    expect(etfs.body.etfs.map((e: { symbol: string }) => e.symbol)).toEqual([
      "ZZSYNETF2",
      "ZZSYNETF3",
      "ZZSYNETF1",
    ]);
    expect(etfs.body.etfs[0]).toMatchObject({ name: SYNTHETIC_NAME, direction: "down" });
    expect(etfs.body.stale).toBe(true);
  });

  const withIndex = (patch: Record<string, unknown>) =>
    board(100, {
      indices: [{ ...index("KSE100", 3, iso(-60_000)), ...patch }, index("KSE30", -3, iso(-60_000))],
    });
  const withEtf = (patch: Record<string, unknown>) =>
    board(100, { etfs: [{ ...etf(1, 0.5, 10), ...patch }, etf(2, 0.5, 20)] });

  const SECTION_REJECTIONS: [reason: string, make: () => unknown, label: string][] = [
    ["bad_indices", () => board(100, { indices: [] }), "empty list"],
    ["bad_index_code", () => withIndex({ code: "KSEALL" }), "not a benchmark"],
    ["duplicate_index", () => withIndex({ code: "KSE30" }), "repeated code"],
    ["bad_indices", () => withIndex({ value: 0 }), "value 0"],
    ["bad_indices", () => withIndex({ direction: "down" }), "direction against the sign"],
    ["bad_index_asof", () => withIndex({ asOf: "2026-10-20T10:00:00" }), "no offset"],
    ["index_asof_in_future", () => withIndex({ asOf: iso(5 * 60_000) }), "future tick"],
    ["bad_etfs", () => board(100, { etfs: [] }), "empty list"],
    ["duplicate_etf", () => withEtf({ symbol: "ZZSYNETF2" }), "repeated symbol"],
    ["bad_etfs", () => withEtf({ price: 0 }), "price 0"],
    ["bad_etfs", () => withEtf({ ldcp: -1 }), "ldcp negative"],
    ["bad_etfs", () => withEtf({ high: 5, low: 6 }), "high below low"],
    ["bad_etfs", () => withEtf({ name: "" }), "no name"],
    ["bad_etfs", () => withEtf({ direction: "down" }), "direction against the sign"],
    ["bad_etfs", () => withEtf({ volume: 1.5 }), "fractional volume"],
  ];

  for (const [reason, make, label] of SECTION_REJECTIONS) {
    test(`rejects ${reason} (${label}) and leaves every stored section unchanged`, async ({ request }) => {
      const response = await post(request, make(), AUTH());
      expect(response.status()).toBe(400);
      expect((await response.json()).reason).toBe(reason);
      expect((await readWatch(request)).body.asOf).toBe(message.asOf);
      const indices = await readIndices(request);
      expect(indices.body.source).toBe("feed");
      expect(indices.body.indices).toHaveLength(3);
      const etfs = await readEtfs(request);
      expect(etfs.body.source).toBe("feed");
      expect(etfs.body.etfs).toHaveLength(3);
    });
  }

  test("a message without indices or ETFs leaves both stored sections intact", async ({ request }) => {
    const plain = board(100, { asOf: iso(-9 * 60_000), marketStatus: "closed" });
    const response = await post(request, plain, AUTH());
    expect(response.status()).toBe(200);
    const accepted = await response.json();
    expect(accepted).not.toHaveProperty("indices");
    expect(accepted).not.toHaveProperty("etfs");

    expect((await readWatch(request)).body.asOf).toBe(plain.asOf);
    const indices = await readIndices(request);
    expect(indices.body.indices.map((i: { code: string }) => i.code)).toEqual(["KSE100", "ALLSHR", "KMI30"]);
    // Still the first message's section: its "open" status and its age.
    expect(indices.body.stale).toBe(true);
    const etfs = await readEtfs(request);
    expect(etfs.body.asOf).toBe(message.asOf);
    expect(etfs.body.etfs).toHaveLength(3);
  });

  test("stale is claimed only when the feed says the market is open", async ({ request }) => {
    const send = async (offsetMs: number, marketStatus?: string) => {
      const asOf = iso(offsetMs);
      const extra: Record<string, unknown> = {
        asOf,
        indices: BENCHMARKS.map((code) => index(code, 1, asOf)),
        etfs: [etf(1, 0.5, 10)],
      };
      if (marketStatus) extra.marketStatus = marketStatus;
      expect((await post(request, board(100, extra), AUTH())).status()).toBe(200);
      return { indices: (await readIndices(request)).body, etfs: (await readEtfs(request)).body };
    };

    let read = await send(-8 * 60_000, "closed");
    expect(read.indices.status).toBe("CLOSED");
    expect(read.indices.missing).toEqual([]);
    expect(read.indices).not.toHaveProperty("stale");
    expect(read.etfs).not.toHaveProperty("stale");

    // No status: never fresh or stale; status from the tick age (7 min → CLOSED).
    read = await send(-7 * 60_000);
    expect(read.indices.status).toBe("CLOSED");
    expect(read.indices).not.toHaveProperty("stale");
    expect(read.etfs).not.toHaveProperty("stale");

    read = await send(-6 * 60_000, "unknown");
    expect(read.indices).not.toHaveProperty("stale");
    expect(read.etfs).not.toHaveProperty("stale");

    read = await send(-30_000, "open");
    expect(read.indices.status).toBe("OPEN");
    expect(read.indices.stale).toBe(false);
    expect(read.etfs.stale).toBe(false);
  });

  test("the indices and ETF endpoints take no writes", async ({ request }) => {
    for (const path of ["/api/market/indices", "/api/market/etfs"]) {
      const response = await request.post(path, {
        data: board(100, { asOf: iso(0) }),
        headers: { Authorization: AUTH() },
      });
      expect(response.status(), `${path} refuses POST`).toBe(405);
    }
  });
});
