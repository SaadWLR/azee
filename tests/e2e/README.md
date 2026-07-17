# E2E tests (Playwright)

## Run

```bash
npm run test:e2e
```

Running against production also needs the rate-limit bypass secret —
see the next section. Without it the suite still runs, but later tests
can fail with 429s.

## Rate-limit bypass (required for production runs)

The production API sits behind a Vercel WAF rate-limit rule
(**30 requests / 60s per IP**). The suite's cumulative volume exceeds
that, which used to 429 its own later-scheduled tests. A Vercel
Firewall exception lets requests carrying the **`x-e2e-bypass`** header
with the correct secret skip that rule, and `playwright.config.ts`
attaches that header to every request the suite makes.

**The secret is never stored in this repo.** Supply it via the
`E2E_BYPASS_SECRET` environment variable, either way:

**1. Local — a gitignored `.env` at the repo root** (simplest; the
config reads it automatically, no `dotenv` dependency needed):

```bash
# .env  — gitignored, never commit this file
E2E_BYPASS_SECRET=<the secret from the Vercel dashboard>
```

**2. Shell / CI — a real environment variable** (always wins over
`.env`):

```bash
# bash
E2E_BYPASS_SECRET=<secret> npm run test:e2e

# PowerShell
$env:E2E_BYPASS_SECRET = "<secret>"; npm run test:e2e
```

In CI, add `E2E_BYPASS_SECRET` as an encrypted secret and expose it to
the step that runs `npm run test:e2e`.

Where to find the secret: the Vercel dashboard → project → Firewall →
the `api-rate-limit` rule's bypass exception (also stored as a Vercel
environment variable). Ask the project owner if you don't have access.

If the secret is missing and the run targets production, the config
prints a prominent warning naming this section — it will not fail
silently and then look like a wall of mysterious 429 bugs.

**How the header is attached (and why not `extraHTTPHeaders` globally):**
`use.extraHTTPHeaders` in `playwright.config.ts` would add the header
to *every* request the browser makes, including cross-origin ones —
which turns the Google Fonts requests into CORS-preflighted requests
that get blocked (`Request header field x-e2e-bypass is not allowed by
Access-Control-Allow-Headers`), breaking fonts and the clean-console
assertions. Since the WAF rule only matches `/api/*`, the header is
scoped to those requests instead:

- **Page-based specs** get it from `tests/e2e/fixtures.ts` (an auto
  fixture that routes `**/api/**`). These specs import `test`/`expect`
  from `./fixtures` rather than `@playwright/test` — keep that import
  when adding a new page-based spec, or it will hit rate limits.
- **`api-contracts.spec.ts`** calls `/api/*` through the `request`
  context, which page routing does not intercept, so it sets the
  header via `test.use({ extraHTTPHeaders })`. That is safe there
  precisely because it loads no page (no fonts, no CORS).

## What these tests target — and why production

Tests run against **https://azee.vercel.app by default**. This project
has no local Vercel-functions-in-dev setup: under `vite dev`, the
service layer falls back to fixtures (`import.meta.env.DEV`), so the
live data path — serverless functions, PSX adapters, edge caching —
only exists on a deployment. Testing production is currently the only
accurate signal for the thing that matters most here: **no fabricated
market data is ever reachable in production.**

Consequence: assertions read real live market data and therefore check
plausible ranges and structural truths (e.g. KSE-100 between 100k and
300k, ≥50 market-watch rows), never exact live values.

## Pointing at a preview deployment

```bash
PLAYWRIGHT_BASE_URL=https://azee-git-<branch>.vercel.app npm run test:e2e
```

(PowerShell: `$env:PLAYWRIGHT_BASE_URL = "…"; npm run test:e2e`)

Use this for pre-merge verification once CI wiring lands.

## Layout

| Spec | Covers |
| --- | --- |
| `homepage-smoke.spec.ts` | Load, title, nav/hero/footer, clean console — at 1920/1440/768/375 |
| `market-snapshot.spec.ts` | Live KSE-100 plausibility; live stats present; **fabricated-stats regression guard** (Market Value / sectors / IPOs / Symbols Traded must never reappear in the panel) |
| `ticker-tape.spec.ts` | Marquee renders ≥10 live quotes; old fixture-order leak guard; clean console |
| `api-contracts.spec.ts` | `/api/market/snapshot` has no `stats` key; `/api/market/watch` row floor & shape; forbidden fabricated strings absent (runs once, desktop project) |

History note: this suite (added Jul 11, 2026) is the repo's first
Playwright installation — earlier milestone verifications were ad-hoc
scripts that were never persisted.
