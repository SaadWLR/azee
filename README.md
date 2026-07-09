# AZEE Trade — Hero Section

A premium homepage hero for **AZEE Securities (Pvt.) Ltd.** (azeetrade.com), a
Pakistan Stock Exchange brokerage — TREC Holder No. 108 on PSX and PMEX,
operating since 2003.

Built with React 18, TypeScript, Tailwind CSS 4, and Vite 6. No other
dependencies.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

## Replacing the background video

The hero video is controlled by a single constant in
[`src/config.ts`](src/config.ts):

```ts
export const HERO_VIDEO_URL = "...";
```

Point it at any MP4 (a trading-terminal, stock-chart, or Karachi skyline
clip works well). The video renders full-screen, `object-cover`, autoplay,
muted, looped, `playsInline`, with no overlay, gradient, or tint.

## Structure

| File | Purpose |
| --- | --- |
| `src/components/Hero.tsx` | Full-screen video hero with parallax, particles, bottom-aligned content |
| `src/components/Navbar.tsx` | Fixed liquid-glass navbar |
| `src/components/AnimatedHeading.tsx` | Character-by-character staggered heading |
| `src/components/FadeIn.tsx` | Delay-based fade/slide-in wrapper |
| `src/components/MarketSnapshot.tsx` | PSX Market Snapshot glass dashboard (KSE-100 counter, session stats, research) |
| `src/components/TickerTape.tsx` | Scrolling PSX symbol ticker tape |
| `src/components/TrustBadges.tsx` | Regulatory trust indicators under the CTAs |
| `src/components/WhyAzee.tsx` | Credential highlight cards (TREC, SECP, CDC, PMEX…) |
| `src/components/Products.tsx` | Products & services card grid |
| `src/components/Research.tsx` | Research section — featured report + article cards, grid-line backdrop |
| `src/components/AppShowcase.tsx` | AZEE Stockify showcase with floating phone mockup and store badges |
| `src/components/Stats.tsx` | Animated in-view counters over drifting particles |
| `src/components/Footer.tsx` | Brokerage footer with contact, link columns, and regulatory strip |
| `src/components/Reveal.tsx` | Scroll-triggered reveal wrapper (IntersectionObserver) |
| `src/components/SectionHeading.tsx` | Shared eyebrow/title/description block |
| `src/components/Icons.tsx` | Inline SVG icon set |
| `src/config.ts` | Hero video URL |
| `src/data/marketData.ts` | Typed placeholder market data and research feed — swap in live APIs here |
| `src/index.css` | Inter font setup, `.liquid-glass` surfaces, section backdrops, keyframes |

## Market data

All figures rendered in the hero come from `src/data/marketData.ts` and
reflect actual early-July-2026 PSX sessions (KSE-100 close of Jul 6,
2026). The module is shaped like a market-data feed response: replace
its constants with live values from the PSX data portal
(https://dps.psx.com.pk/) or a broker market-data service and the UI
updates without changes.

## Design constraints

- Inter globally, antialiased.
- Palette: black background, white text, gray-300 secondary, white glass
  borders — no accent colors or gradients beyond the glass surfaces.
- All copy reflects AZEE Securities' real services (PSX equities, equity
  research, online trading) with no invented statistics.
