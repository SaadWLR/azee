# Market Data Research & Architecture — Phase 2

**Project:** AZEE Trade homepage (React + TypeScript + Vite)
**Date:** July 9, 2026
**Status:** Research & architecture only — no implementation in this phase
**Deployment target:** Vercel

---

## 1. Executive Summary

Every candidate source of Pakistani market data was researched and, where
possible, **verified empirically** by probing endpoints on July 9, 2026.
The findings are unambiguous:

1. **The PSX Data Portal (dps.psx.com.pk) is the only free, first-party
   source of KSE-100 and PSX equity data.** It serves undocumented but
   stable JSON endpoints with no authentication — verified live during
   this research (the intraday feed returned the actual session level of
   181,259.67). It sends **no CORS headers**, so browsers cannot call it
   directly: a server-side proxy is mandatory, which Vercel serverless
   functions provide naturally.
2. **No mainstream international API covers PSX** — Yahoo Finance,
   Stooq, Alpha Vantage, Twelve Data, FMP, Polygon, and Finnhub were all
   ruled out (the first two verified by direct probe). The one exception
   is **EODHD**, which lists PSX as its `KAR` exchange from $19.99/month.
3. **Mettis Global** is Pakistan's institutional data vendor (MG Link).
   It has no public API — access is negotiated commercially. It is the
   correct upgrade path for licensed real-time data and a news wire, not
   a starting point.
4. **AZEE's own research content has no feed** (RSS probes returned
   404). Research reports and commentary should be treated as
   first-party CMS content, not scraped.

**Recommendation:** build on the **PSX Data Portal behind Vercel
serverless functions with layered caching**, add **EODHD (KAR)** as a
paid redundancy/fundamentals source when budget allows, and engage
**PSX's market-data team** (marketdatarequest@psx.com.pk) to confirm
commercial display terms before public launch. Section 5 details the
architecture; Section 10 gives the implementation order.

---

## 2. Source-by-Source Findings

### 2.1 Pakistan Stock Exchange — Data Portal (dps.psx.com.pk)

The PSX runs two web properties: the corporate site (psx.com.pk) and
the **Data Portal Service** (dps.psx.com.pk). The portal backs its pages
with JSON endpoints that are publicly reachable.

**Endpoints verified by direct probe on July 9, 2026:**

| Endpoint | Result | Content |
| --- | --- | --- |
| `GET /timeseries/int/KSE100` | `200`, `application/json`, 43 KB | Intraday series `[[epochSec, value, volume], …]` at ~15-second resolution; returned the live session level (181,259.67) |
| `GET /timeseries/eod/KSE100` | `200`, `application/json`, 52 KB | Daily series `[[epochSec, close, volume, value], …]`, multi-year history |
| `GET /market-watch` | `200`, HTML, 476 KB | Full market table for every listed symbol (LDCP, current, change, volume) — parseable server-side |
| `GET /indices` | `200`, HTML | All PSX indices with levels and changes |
| `GET /company/HBL` | `200`, HTML | Per-company quote, profile, and fundamentals page |
| `GET /download/mkt_summary/2026-07-07.Z` | `200`, `application/octet-stream`, 23 KB | Official end-of-day market summary file (per-date archive) |
| CORS preflight with `Origin` header | **No `Access-Control-Allow-Origin`** | Browser calls impossible; server proxy required |

**Assessment:**

| Attribute | Finding |
| --- | --- |
| Authentication | None for portal endpoints |
| Documentation | None — endpoints are the portal's own AJAX backend |
| Real-time vs delayed | Portal data is the exchange's public display feed; licensed real-time/Level-2 (order book, tick-by-tick) is sold separately via [Data Services Vending](https://www.psx.com.pk/psx/product-and-services/data-services-vending) |
| Rate limits | Undocumented — assume low tolerance; cache aggressively, one upstream fetch per cache window |
| Commercial usage | Governed by PSX data policy; contact **marketdatarequest@psx.com.pk** for display licensing before commercial launch |
| CORS | Absent — serverless proxy mandatory |
| Reliability | First-party exchange infrastructure; nginx-fronted; the community ecosystem (psxdata, PSX-Data-Api, a PSX MCP server) has scraped it stably for years, which is evidence of endpoint stability but also of undocumented status |
| Cost | Free (portal); licensed feeds priced by PSX |

**Verdict: primary source.** First-party, free, verified live, JSON for
the exact data the homepage renders (index level, volumes, market
watch). Risks (undocumented, no SLA, licensing clarity) are mitigated by
caching, adapter isolation, a paid fallback, and the licensing inquiry.

### 2.2 AZEE Securities (azeetrade.com)

Probed and researched July 9, 2026:

- **No RSS/Atom feeds** — `azeetrade.com/feed` → 301 → 404 (verified).
- Site is PHP page-based (`*.php`); research/news content lives in page
  templates (Market News, Board Meetings, Announcements, Dividend
  Calendar, Blogs, Knowledge Centre) with no machine-readable feed.
- Public resources confirmed earlier in this project: company profile,
  regulatory identifiers (TREC 108, SECP 0041920, CDC 04184, NCCPL
  C0418401), platform information (Stockify, Tick, Trade Terminal,
  Analytics, Call n Trade), account-opening flows via
  `azeetrade.com/home/register`.
- No public API for accounts, portfolios, or research distribution.

**Legal position:** this project is AZEE's own web presence, so its
research and company content is **first-party content** — the correct
integration is a small CMS or repository-managed JSON/Markdown that the
research desk edits, served through the existing `researchService` /
`companyService`. Nothing needs to be scraped, and third-party scraping
of a brokerage site would be inappropriate anyway. Client-account data
would come from the broker's back-office system and is out of scope for
the public homepage.

**Verdict: first-party CMS content, not an API integration.**

### 2.3 Mettis Global (mettisglobal.news / MG Link)

- Pakistan's institutional financial-data vendor and the country's only
  registered business news agency; offices in Karachi, Lahore,
  Islamabad.
- Products: **MG Link** terminal (real-time quotes, streaming news,
  fundamentals, economic calendar, corporate actions), plus **data
  solutions** for corporate treasuries and financial institutions
  covering equity, fixed income, FX, commodities, funds, and macro.
- **No public API or pricing** — everything is negotiated commercially.
  RSS probe (`/feed/`) → 404 (verified). Scraping their news site would
  violate their commercial model and is ruled out.
- Reliability reputation is strong (banks and AMCs are clients).

**Verdict: the professional upgrade path.** When AZEE wants licensed
real-time equity data, a news wire, or fixed-income/FX data on the
site, a Mettis (or PSX direct vendor) contract is the answer. Not
suitable as the free-tier starting point.

### 2.4 International Providers

| Provider | PSX equities | KSE-100 | Notes (verified where marked) |
| --- | --- | --- | --- |
| **EODHD** | ✅ as `KAR` exchange | ✅ | EOD + splits/dividends + fundamentals from **$19.99/mo** ("All World"); live/delayed APIs on higher tiers; documented REST, API-key auth, published rate limits (~1k calls/day free tier, higher paid) |
| Yahoo Finance (unofficial) | ❌ | ❌ | `^KSE100` chart API returns 404 "symbol may be delisted" — **verified by probe**; also unofficial/ToS-fragile |
| Stooq | ❌ | ❌ | `^KSE` CSV endpoint returns "page does not exist" — **verified by probe** |
| Alpha Vantage | ❌ | ❌ | No Pakistani exchange in coverage list |
| Twelve Data | ❌ | ❌ | No PSX in exchange coverage |
| Financial Modeling Prep | ❌ | ❌ | No PSX coverage |
| Polygon.io | ❌ | ❌ | US markets only |
| Finnhub | ❌ | ❌ | No PSX in supported exchanges |
| TradingView | ✅ (display) | ✅ (display) | Has PSX symbols but only as **embeddable widgets** — no raw data API; widgets would clash with the bespoke UI |
| Investing.com | ✅ (site) | ✅ (site) | No API; scraping prohibited by ToS — excluded |
| Sarmaaya.pk / community libs | via DPS | via DPS | Pakistani portals and GitHub projects (psxdata, PSX-Data-Api, PSX MCP server) are all wrappers over the same PSX Data Portal — useful as implementation references, not as dependencies |

**Verdict:** EODHD is the only credible international option and earns
the **secondary provider** slot: documented, cheap, and covering EOD +
fundamentals for PSX — ideal as a fallback and for historical charts,
while first-party DPS covers intraday.

---

## 3. Comparison Matrix

| Criterion | PSX Data Portal | EODHD (KAR) | Mettis Global | AZEE CMS content |
| --- | --- | --- | --- | --- |
| Data | Intraday index, market watch, indices, company pages, EOD files | EOD, fundamentals, delayed/live on higher tiers | Real-time everything + news wire | Research, news, company profile |
| Pricing | Free (portal); licensed feeds quoted by PSX | $19.99/mo entry | Commercial contract | Internal cost only |
| Reliability | High (exchange infra) but no SLA | High, SLA-backed product | Very high, institutional | N/A |
| Update frequency | ~15 s intraday series; EOD files nightly | EOD daily; delayed intraday on paid tiers | Real-time | On publish |
| Rate limits | Undocumented — self-throttle | Documented per plan | Contractual | N/A |
| Auth | None | API key | Contractual | N/A |
| Commercial licence | Requires PSX confirmation for public display | Included in subscription | Included in contract | Owned |
| Ease of integration | Medium (JSON + some HTML parsing; proxy required) | Easy (documented REST) | Unknown (bespoke) | Easy |
| Vercel suitability | Excellent behind serverless proxy | Excellent (key stays server-side) | Depends on delivery method | Excellent |
| Long-term maintainability | Medium (undocumented endpoints → isolate in adapter) | High | High | High |

---

## 4. Recommendation

1. **Primary: PSX Data Portal** behind Vercel serverless functions —
   first-party, free, verified, and sufficient for everything the
   homepage shows (KSE-100, snapshot stats, ticker, gainers/losers).
2. **Secondary (when budget allows): EODHD `KAR`** — documented paid
   API used as automatic fallback when DPS misbehaves, and as the
   source for deep history and fundamentals.
3. **Research/news/company: first-party content** through the existing
   `researchService`/`companyService`/`newsService`, backed by
   repo-managed JSON or a lightweight CMS.
4. **Real-time upgrade path:** PSX licensed feed or Mettis Global
   contract, dropped in as another adapter behind the same normalized
   interfaces.
5. **Action item before launch:** written confirmation from
   marketdatarequest@psx.com.pk on portal-data display terms for a
   TREC holder's website (AZEE, as PSX member #108, is well placed).

The deciding factors: DPS is the only free source of truth and the site
must never show fake data; provider risk is handled structurally
(adapter isolation + paid fallback) rather than by trusting any single
vendor; and everything fits Vercel's serverless + edge-cache model
without extra infrastructure.

---

## 5. Final Data Architecture

```
┌───────────────────────────── FRONTEND ─────────────────────────────┐
│  React components (MarketSnapshot, TickerTape, Research, …)        │
│        │ props/state                                               │
│  React hooks (useMarketSnapshot, useTickerQuotes, …)               │
│        │ AsyncState<T> — loading / data / error / stale            │
│  Services (marketService, researchService, newsService, company)   │
│        │ fetch("/api/…")            ← swap: mockResponse → apiGet  │
└────────┼───────────────────────────────────────────────────────────┘
         ▼
┌──────────────────── VERCEL SERVERLESS (/api) ──────────────────────┐
│  /api/market/snapshot   /api/market/ticker   /api/market/history   │
│  /api/research/reports  /api/news            /api/company          │
│        │                                                           │
│  Provider adapters:  psxDpsAdapter ── primary                      │
│                      eodhdAdapter ─── fallback (circuit breaker)   │
│                      cmsAdapter ───── research/news/company        │
│        │                                                           │
│  Normalizer → the /src/types interfaces (one shape, any provider)  │
│  Cache: Cache-Control s-maxage + stale-while-revalidate (edge)     │
│         + optional Upstash Redis for last-good persistence         │
└────────┼───────────────────────────────────────────────────────────┘
         ▼
   PSX Data Portal (JSON/HTML)   EODHD REST   CMS / repo JSON
```

**Why this architecture:**

- **The proxy is not optional.** DPS sends no CORS headers and EODHD
  keys must never reach the browser. Vercel functions solve both and
  add a place to normalize and cache.
- **The frontend never changes again.** Components already consume
  `AsyncState<T>` hooks over services (built in Phase 1). Going live is
  editing service internals from `mockResponse(fixture)` to
  `apiGet("/api/…")` — zero component edits, which is exactly the
  boundary this phase was asked to protect.
- **Adapters absorb provider risk.** DPS is undocumented; if an
  endpoint shifts, only `psxDpsAdapter` changes. If DPS goes down, the
  circuit breaker flips to EODHD and the frontend cannot tell.
- **Edge caching turns rate-limit anxiety into arithmetic.** With
  `s-maxage=60`, all visitors worldwide cost DPS at most one request
  per minute per endpoint, regardless of traffic — polite to an
  undocumented API and fast for users.
- **Everything is Vercel-native.** No servers, no cron infrastructure
  (Vercel Cron can pre-warm caches), no databases required to start;
  Upstash Redis is a drop-in later for cross-invocation last-good
  storage.

---

## 6. Caching Policy

PSX trading hours: ~09:30–15:30 PKT, Monday–Friday (Friday split
session; exchange calendar has holidays — the proxy should embed a
trading calendar).

| Data | Market open | Market closed | Mechanism |
| --- | --- | --- | --- |
| KSE-100 level (snapshot) | `s-maxage=60, stale-while-revalidate=300` | `s-maxage=3600` until next open | Edge cache |
| Market snapshot (stats, volume, value) | 120 s | 3600 s | Edge cache |
| Ticker quotes | 60 s | 3600 s | Edge cache |
| Top gainers / losers | 120 s | 3600 s | Edge cache |
| Intraday chart series | 300 s | until next open | Edge cache |
| Research reports | 3600 s (or on-publish revalidation) | same | Edge + ISR-style revalidate |
| News | 300–900 s | same | Edge cache |
| Company info | 86400 s | same | Edge cache |

`stale-while-revalidate` on every entry: users always get an instant
response; refresh happens in the background. A Vercel Cron ping each
minute during market hours keeps caches warm so no visitor ever waits
on DPS.

---

## 7. Error Handling & Degraded States

Guiding rule: **never fabricate data; always label staleness.**

| Failure | Behaviour |
| --- | --- |
| PSX unavailable | Circuit breaker (e.g. 3 consecutive failures) flips to EODHD for whatever it can serve (EOD level, quotes); response is flagged `source: "fallback"`, `delayed: true` |
| Both providers down | Serve **last-good payload** from Redis/edge cache with `stale: true` and its original timestamp; UI keeps rendering the data with its existing "Data: Pakistan Stock Exchange · …" line showing the as-of time |
| No cache at all (cold start + outage) | API returns typed `503 { error }`; hooks expose `error`; sections render their static shells (the panel already fades in only when data exists) — no invented numbers |
| Provider rate-limits us | Treated as failure → fallback/last-good; self-inflicted limiting is prevented by the edge cache (≤1 upstream call per window) and single-flight de-duplication inside the function |
| Market closed | Not an error: snapshot returns `status: "CLOSED"` (the UI already renders a CLOSED badge state), plus `asOf` of the last session; caches lengthen per §6 |
| Empty/malformed payload | Adapter validates shape (lightweight schema guard); malformed → treated as failure, last-good served; incident logged |
| Simulated drift | The current `useLiveDrift` visual effect is retired the day real data lands — replaced by real polling deltas so flashes reflect actual ticks |

---

## 8. Normalized Interfaces

Already implemented in `/src/types` during Phase 1 and adopted here as
the provider-independent contract (the frontend never sees a provider
format):

```ts
// market.ts
type Direction = "up" | "down";
type MarketStatus = "OPEN" | "CLOSED";

interface MarketIndex {
  name: string;          // "KSE-100 Index"
  value: number;         // 181259.67
  changePercent: number; // +1.12
  changePoints: number;  // +2082.49
  direction: Direction;
}

interface StockQuote {
  symbol: string;        // "OGDC"
  price: number;
  changePercent: number;
}

interface MarketStat {
  label: string;         // "Market Volume"
  value: string;         // "703.7M shares"
  direction?: Direction;
}

interface MarketSnapshot {
  index: MarketIndex;
  stats: MarketStat[];
  status: MarketStatus;
  timestamp: string;     // becomes ISO asOf when live
}

// research.ts
interface ResearchReport {
  category: ResearchCategory;
  title: string;
  excerpt: string;
  date: string;
  readMinutes: number;
  featured?: boolean;
}

// news.ts
interface NewsItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  url?: string;
}

// company.ts
interface CompanyInfo {
  legalName: string;
  brand: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  memberSince: number;
  regulatory: RegulatoryInfo;
}
```

**Planned live-phase additions** (non-breaking): `asOf: string` and
`source: "psx" | "eodhd" | "cache"` on `MarketSnapshot`, `stale?:
boolean` on API envelopes, and `volume?`/`ldcp?` on `StockQuote` for
the market-watch mapping.

**Mapping sketch (DPS → normalized):** `timeseries/int/KSE100` last
element → `MarketIndex.value`; previous close from `timeseries/eod` →
`changePoints/changePercent/direction`; market-watch table rows →
`StockQuote[]` (sorted for gainers/losers); indices page + EOD file →
`MarketStat[]`.

---

## 9. Recommended Implementation Order

1. **Licensing email to PSX** (parallel to all work) — display terms
   for portal data on a TREC holder's site.
2. **`/api/market/snapshot`** — DPS adapter (intraday + EOD series),
   normalizer, edge cache headers; flip `marketService.getMarketSnapshot`
   from `mockResponse` to `apiGet`.
3. **`/api/market/ticker`** — market-watch parse for the 12 ticker
   symbols; flip `getTickerQuotes`.
4. **Trading calendar + market-status logic** (drives cache windows and
   the OPEN/CLOSED badge).
5. **Last-good persistence** (Upstash Redis) + circuit breaker.
6. **Research/news/company as repo JSON or CMS** behind the existing
   services.
7. **EODHD subscription + adapter** as fallback and history source.
8. **Retire `useLiveDrift`** in favour of real polling deltas.
9. **Observability** — log provider latencies/failures; alert on
   sustained fallback.

## 10. Future Improvements

- **Real-time upgrade:** PSX licensed feed or Mettis Global contract →
  WebSocket/SSE gateway (would move off pure serverless for the socket
  component, e.g. a small edge/socket service).
- **Gainers/losers/breadth section** on the homepage — DPS market-watch
  already contains everything needed.
- **Per-company pages** (quote + fundamentals) from DPS company data +
  EODHD fundamentals.
- **Historical charting** (KSE-100 and per-symbol) from
  `timeseries/eod` + EODHD history.
- **Push-based cache warming** via Vercel Cron during market hours.
- **News wire** integration once a Mettis/agency contract exists.

---

## Sources

- PSX Data Portal (endpoints verified by probe, Jul 9 2026): https://dps.psx.com.pk/
- PSX Data Services Vending: https://www.psx.com.pk/psx/product-and-services/data-services-vending
- PSX downloads page: https://dps.psx.com.pk/downloads
- EODHD KAR exchange: https://eodhd.com/exchange/KAR
- EODHD exchange list: https://eodhd.com/list-of-stock-markets
- Mettis Global / MG Link: https://mettisglobal.news/mg-link/ · https://mettisglobal.news/MarketData
- AZEE Securities: https://azeetrade.com/ (feed probes 404, Jul 9 2026)
- Community references: https://github.com/mtauha/psxdata · https://github.com/AbdulSami455/PSX-Data-Api
