# E2E tests (Playwright)

## Run

```bash
npm run test:e2e
```

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
