# Live KSE-100 Implementation — Phase 3

**Date:** July 9, 2026
**Scope:** Replace only the mock KSE-100 data with live PSX data.
Everything else (ticker quotes, session stats, research, news, company
info) remains fixture-backed for later phases. UI unchanged.

---

## Endpoint

### `GET /api/market/snapshot` (Vercel serverless function)

Source files:

- [`api/market/snapshot.ts`](../api/market/snapshot.ts) — HTTP handler,
  caching, last-good fallback
- [`api/_lib/psxKse100.ts`](../api/_lib/psxKse100.ts) — PSX adapter and
  normalizer (the raw PSX payload never leaves this module)

Upstream (server-side only — the browser never calls PSX, which sends
no CORS headers anyway):

| PSX endpoint | Used for |
| --- | --- |
| `https://dps.psx.com.pk/timeseries/int/KSE100` | Latest index value + tick time (`[[epochSec, value, volume], …]`, newest first, ~15 s resolution) |
| `https://dps.psx.com.pk/timeseries/eod/KSE100` | Previous session close for change calculations |

## Normalization

The route returns the existing `MarketSnapshot` interface — no
provider format reaches the frontend:

- `index.value` — first (newest) intraday point, rounded to 2 dp
- previous close — newest EOD entry whose **PKT calendar day** differs
  from the latest tick's day (the newest EOD entry becomes the current
  session once trading starts)
- `index.changePoints` = value − previousClose;
  `index.changePercent` = changePoints / previousClose × 100;
  `index.direction` = sign of changePoints
- `status` — `"OPEN"` when the newest tick is ≤ 5 minutes old,
  otherwise `"CLOSED"`; data-driven, so exchange holidays and special
  sessions need no calendar
- `asOf` — ISO timestamp of the underlying tick;
  `source: "psx" | "cache"`; `stale?: true` on outage fallback
  (all optional, non-breaking additions to the type)
- `stats` / `timestamp` — unchanged Phase-1 placeholder rows, pending
  the market-watch endpoint in a later phase
- Payload validation: non-`ok` HTTP, `status !== 1`, empty or
  malformed series all throw → error path (never partial data)

## Caching strategy

Vercel edge caching via `Cache-Control`, so PSX receives at most one
request per cache window regardless of site traffic:

| State | Header |
| --- | --- |
| Market open | `s-maxage=60, stale-while-revalidate=300` |
| Market closed | `s-maxage=1800, stale-while-revalidate=86400` |
| Serving last-good during outage | `s-maxage=30, stale-while-revalidate=600` |
| 503 (no data at all) | `no-store` |

`stale-while-revalidate` means visitors always get an instant cached
response while the edge refreshes in the background.

## Failure behaviour

Rule: **never fabricate data.**

1. PSX unreachable / malformed → serve the **last known-good snapshot**
   (kept in module scope across warm invocations) with
   `stale: true, source: "cache"`.
2. No last-good available (cold start during an outage) → structured
   `503 { "error": "KSE-100 market data is temporarily unavailable" }`.
   The frontend's `useAsyncData` surfaces this as `error`; the snapshot
   panel and phone screen simply don't render their data blocks —
   nothing invented, no crash.
3. Market closed is **not** an error: `status: "CLOSED"` renders the
   panel's existing CLOSED badge state with the last session's level.

## Refresh frequency

- Edge cache: 60 s during the session → visitors see index values at
  most a minute old while PSX is emitting ticks (upstream feed itself
  updates ~every 15 s).
- After close: 30-minute cache; the value is static until the next
  session anyway.
- The client fetches once per page load (no polling yet — a later
  phase adds polling/SSE and retires the `useLiveDrift` visual).

## Frontend change

One function edited — `marketService.getMarketSnapshot()`:

- **Production:** `apiGet<MarketSnapshot>("/api/market/snapshot")`
- **Dev (`vite dev`):** returns the fixture, because Vercel functions
  don't run under the Vite dev server (use `vercel dev` to exercise
  the route locally)

Two rendering corrections were forced by live data (the only component
edits): the snapshot panel and app-mockup screen hard-coded a green
`▲ +` prefix, which would render "▲ +-369.69" on a down day. Both now
derive arrow, sign, and color from `index.direction`. Up-day rendering
is pixel-identical to before.

## Validation (performed July 9, 2026)

Adapter executed directly against live PSX plus an independent
recomputation from the raw feeds:

| Check | Result |
| --- | --- |
| Live value matches PSX intraday feed | ✅ 181,259.67 (tick 15:50 PKT) |
| Change matches | ✅ −369.69 pts vs Jul 8 close 181,629.36 |
| Percentage matches | ✅ −0.20% |
| Market status correct | ✅ CLOSED (validated at ~21:30 PKT; tick age 339 min) |
| External corroboration | ✅ Feed's Jul 7 close 186,255.55 matches Business Recorder's reported close exactly |
| Types valid / build | ✅ `tsc` (src + api) and `vite build` clean |
