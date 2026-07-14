/**
 * Minimal HTTP client for the market-data backend.
 *
 * Services call apiGet<T>() for live data; DEV builds resolve local
 * fixtures through mockResponse() instead (see the service layer's
 * import.meta.env.DEV gating), so the dedup/cache below is naturally
 * production-only — fixtures never reach this module.
 *
 * apiGet coalesces and briefly caches concurrent GETs to the same URL
 * so that the several components which independently need the same
 * endpoint on a single page load (e.g. the market panel and the app
 * mockup both reading the snapshot; the ticker and the stats row both
 * reading market-watch) share ONE real network request instead of
 * each firing their own. This halves-or-better the per-visitor
 * request count and keeps a page load well under the API rate limit.
 */

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/*
 * How long a resolved GET stays served from cache. 2.5s is the chosen
 * balance: long enough to collapse the initial mount burst of a page
 * load (all data hooks mount in the same render commit, but staggered
 * effect flushes / a slightly-late conditional mount can miss the
 * in-flight window by a few hundred ms), yet ~30x shorter than the
 * shortest real poll interval (ticker 75s, news 6min, snapshot no
 * poll). Because the TTL is far below every poll interval, a poll
 * firing on schedule always finds the cache expired and genuinely
 * refetches — the dedup layer can never serve stale data to a poll.
 */
const DEDUP_TTL_MS = 2500;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/** Resolved responses, briefly, keyed by full request URL. */
const responseCache = new Map<string, CacheEntry>();
/** Requests currently in flight, keyed by full request URL. */
const inFlight = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Dedup/cache only applies to plain idempotent GETs. A request with a
 * body or a non-GET method bypasses the shared layer entirely so it
 * can never be conflated with a cached GET.
 */
function isCoalescable(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" && init?.body == null;
}

async function rawFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `GET ${url} failed with status ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Cache key is the exact URL incl. query params, so different
  // params (e.g. a future ?range=...) are never conflated.
  const url = `${API_BASE_URL}${path}`;

  if (!isCoalescable(init)) {
    return rawFetch<T>(url, init);
  }

  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Coalesce: a concurrent caller for the same URL awaits the same
  // in-flight fetch rather than starting another network request.
  const pending = inFlight.get(url);
  if (pending) return pending as Promise<T>;

  const request = rawFetch<T>(url, init)
    .then((value) => {
      // Cache only successful responses — a failure must not be
      // cached, so the next caller (or poll) genuinely retries.
      responseCache.set(url, { value, expiresAt: Date.now() + DEDUP_TTL_MS });
      return value;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request as Promise<T>;
}

/**
 * Wraps a fixture in a resolved promise so mock services share the
 * exact call shape of apiGet.
 */
export function mockResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}
