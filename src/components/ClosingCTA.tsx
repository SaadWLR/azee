import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllMarketQuotes } from "../hooks/useMarketData";
import type { StockQuote } from "../types";

/**
 * #start-investing — the conversion section.
 *
 * FUNCTIONALLY UNCHANGED. The live PSX symbol lookup — the hook, the
 * filtering, the most-active derivation, the selection logic and every
 * loading/error/no-match branch — is exactly as built. This pass is
 * presentational only. The ErrorBoundary wrapping it in App.tsx is
 * untouched.
 *
 * WHAT CHANGED, and why:
 *  · The two radial-gradient corner glows are GONE. They were an
 *    abstract colour wash representing nothing, which the design spec
 *    forbids outright. The section is now flat ink with one solid
 *    second tone behind the lookup panel — a simple two-tone block, no
 *    gradient anywhere in the section.
 *  · The result card carries a real surface at a large radius, tilted
 *    in perspective with a long directional shadow. It was outline-only
 *    for one pass; with no fill there was no silhouette for the
 *    rotation to read against, so it computed correctly and looked
 *    flat. It is a solid slab again — but a floating, tilted one, not
 *    the muted dashboard widget it started as.
 *  · Every control is a true capsule (rounded-full): both CTAs, the
 *    chips, and the lookup input, which was previously a rounded
 *    rectangle.
 *
 * ACCENT DISCIPLINE. Orange appears in exactly two places: the primary
 * CTA fill and the small "Live PSX lookup" label. It never fills a
 * large area and is never used as ambient colour.
 *
 * THE VISUAL IS THE TOOL. Nothing decorative was added — what a visitor
 * looks at is the real lookup returning a real quote.
 */

/** How many suggestions to offer, and how many matches to list. */
const SUGGESTION_COUNT = 5;
const MAX_MATCHES = 6;

function fmtPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtVolume(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/** The live quote card — outline-only, large radius, no fill. */
function QuoteCard({ quote }: { quote: StockQuote }) {
  const up = quote.changePercent >= 0;
  return (
    /*
     * A SOLID surface, not an outline.
     *
     * This card used to be `border` with no background, sitting on the
     * panel behind it. A perspective rotation needs a silhouette to
     * read against — with nothing but a hairline outline on near-black
     * there was no shape for the trapezoid to show in, so the tilt
     * computed correctly and looked flat. Filling it a few steps
     * lighter than both the ink ground and the panel gives it an edge
     * that catches the rotation, and the long directional shadow lifts
     * the near corner off the panel.
     */
    <div className="rounded-[28px] border border-[rgb(var(--azee-blue)/0.25)] bg-[rgb(var(--azee-panel))] p-6 shadow-[0_30px_70px_-20px_rgba(2,5,18,0.95)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-wide text-[rgb(var(--azee-chalk))]">
            {quote.symbol}
          </p>
          {quote.name && (
            <p className="mt-0.5 truncate text-sm text-white/50">
              {quote.name}
            </p>
          )}
          {quote.sector && (
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {quote.sector}
            </p>
          )}
        </div>
        {(quote.isKmi30 || quote.isKmiAllShare) && (
          <span className="shrink-0 rounded-full border border-emerald-400/30 px-3 py-1 text-[10px] font-semibold tracking-wide text-emerald-300">
            {quote.isKmi30 ? "KMI-30" : "KMI All-Share"}
          </span>
        )}
      </div>

      <div className="mt-7 flex items-end justify-between gap-4">
        <p className="text-5xl font-semibold tabular-nums tracking-tight text-[rgb(var(--azee-chalk))]">
          {fmtPrice(quote.price)}
          <span className="ml-2 text-sm font-medium text-white/35">PKR</span>
        </p>
        <p
          className={`text-right tabular-nums ${
            up ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <span className="block text-lg font-semibold">
            {up ? "▲ +" : "▼ "}
            {Math.abs(quote.changePercent).toFixed(2)}%
          </span>
          {quote.changePoints !== undefined && (
            <span className="mt-0.5 block text-xs opacity-75">
              {up ? "+" : "−"}
              {fmtPrice(Math.abs(quote.changePoints))} pts
            </span>
          )}
        </p>
      </div>

      <dl className="mt-7 flex items-center gap-10 border-t border-white/10 pt-5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Volume
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-white/75">
            {fmtVolume(quote.volume)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Exchange
          </dt>
          <dd className="mt-1 text-sm font-semibold text-white/75">PSX</dd>
        </div>
      </dl>
    </div>
  );
}

export function ClosingCTA() {
  const { data: quotes, loading, error } = useAllMarketQuotes();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  /*
   * Suggestion chips are the session's most-traded symbols, derived
   * from the same live payload — never a hardcoded list that could go
   * stale or name a delisted company.
   */
  const suggestions = useMemo(() => {
    return [...(quotes ?? [])]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, SUGGESTION_COUNT);
  }, [quotes]);

  const term = query.trim().toUpperCase();
  const matches = useMemo(() => {
    if (!term) return [];
    return (quotes ?? [])
      .filter(
        (q) =>
          q.symbol.includes(term) ||
          q.name?.toUpperCase().includes(term) ||
          q.sector?.toUpperCase().includes(term),
      )
      .slice(0, MAX_MATCHES);
  }, [quotes, term]);

  /*
   * What the card shows: an explicit pick, else the top match for what
   * is being typed, else the most active symbol so the panel is never
   * empty. Every one of those is a real quote from the live payload.
   */
  const active: StockQuote | undefined =
    (picked ? quotes?.find((q) => q.symbol === picked) : undefined) ??
    matches[0] ??
    (term ? undefined : suggestions[0]);

  /** Shared capsule geometry for every control in this section. */
  const pill =
    "rounded-full px-9 py-4 text-center text-[15px] font-semibold transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]";

  return (
    <section
      id="start-investing"
      className="relative w-full bg-[rgb(var(--azee-navy))] py-28 lg:py-40"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[rgb(var(--azee-blue)/0.25)]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        {/* ── Copy + CTA ─────────────────────────────────────────── */}
        <div>
          <p
            className="closing-fade-up eyebrow"
            style={{ animationDelay: "0.1s" }}
          >
            Start investing
          </p>

          <h2 className="font-display mt-8 text-[2.75rem] text-[rgb(var(--azee-chalk))] sm:text-6xl">
            <span className="closing-fade-up block" style={{ animationDelay: "0.25s" }}>
              The market&apos;s live.
            </span>
            <span className="closing-fade-up block" style={{ animationDelay: "0.4s" }}>
              Make your move.
            </span>
          </h2>

          <p
            className="closing-fade-up mt-8 max-w-md text-base leading-relaxed text-white/55"
            style={{ animationDelay: "0.55s" }}
          >
            Look up any company on the Pakistan Stock Exchange — the prices
            beside this are live, the same feed our Market Watch runs on. Open
            an AZEE account to trade them.
          </p>

          <div
            className="closing-fade-up mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.7s" }}
          >
            {/* Primary: solid accent capsule — the section's only fill. */}
            <Link
              to="/get-started"
              className={`${pill} bg-[rgb(var(--azee-orange))] text-white hover:bg-[rgb(var(--azee-orange)/0.9)] sm:w-auto`}
            >
              Open a Trading Account
            </Link>
            {/* Secondary: same capsule, thin outline, no fill. */}
            <Link
              to="/market-watch"
              className={`${pill} border border-white/25 text-white hover:border-white/50 sm:w-auto`}
            >
              See all {quotes?.length ?? ""} symbols
            </Link>
          </div>
        </div>

        {/* ── The live lookup ────────────────────────────────────── */}
        <div
          className="closing-fade-up rounded-[32px] bg-white/[0.04] p-6 sm:p-8"
          style={{ animationDelay: "0.45s" }}
        >
          <label className="block">
            <span className="eyebrow">
              Live PSX lookup
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
              }}
              placeholder="Try OGDC, Lucky Cement, or Commercial Banks…"
              aria-label="Search a PSX symbol, company or sector"
              className="mt-3 w-full rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-sm text-white placeholder:text-white/35 focus:border-[rgb(var(--azee-orange)/0.6)] focus:outline-none"
            />
          </label>

          {/* Most-active chips, derived from the same live payload. */}
          {suggestions.length > 0 && !term && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Most active
              </span>
              {suggestions.map((q) => (
                <button
                  key={q.symbol}
                  type="button"
                  onClick={() => {
                    setPicked(q.symbol);
                    setQuery("");
                  }}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                    picked === q.symbol
                      ? "bg-[rgb(var(--azee-chalk))] text-[rgb(var(--azee-navy))]"
                      : "border border-white/15 text-white/65 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {q.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Matches for what is being typed. */}
          {term && matches.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {matches.map((q) => (
                <button
                  key={q.symbol}
                  type="button"
                  onClick={() => {
                    setPicked(q.symbol);
                    setQuery("");
                  }}
                  className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/65 transition-colors duration-300 hover:border-white/40 hover:text-white"
                >
                  {q.symbol}
                </button>
              ))}
            </div>
          )}

          {/*
           * DIMENSIONAL RESULT CARD.
           *
           * `perspective` lives here, on the IMMEDIATE parent of the
           * transformed node — applying it to a grandparent silently
           * degrades rotateY to a flat orthographic squish, which is
           * exactly how the #trading device ended up looking straight-on
           * despite reporting a matrix3d transform.
           *
           * Desktop only. The tilt is applied to the DISPLAY card, never
           * to the input or the chips above it — controls you type into
           * and click stay flat and square to the reader. On mobile the
           * card is flat too: a 16-degree rotation on a 375px-wide
           * screen costs legibility of live prices and buys nothing.
           *
           * None of this touches the lookup itself.
           */}
          <div className="mt-7 lg:[perspective:1400px]">
            {/*
             * Angles raised to the reference floor. -16deg was
             * geometrically real but imperceptible on THIS object: the
             * card is wide and short (423x296) where the #trading device
             * is narrow and tall (288x540), and a rotateY reads as a
             * difference in left-vs-right edge height — a short element
             * gives that difference almost no edge to show along. More
             * rotation, plus the solid fill on the card itself, is what
             * makes the depth visible rather than merely present.
             *
             * Hover still eases it toward upright so the live numbers
             * are easy to read when someone actually looks at them.
             */}
            <div className="transition-transform duration-500 lg:[transform:rotateY(-24deg)_rotateX(8deg)_rotateZ(2deg)] lg:hover:[transform:rotateY(-8deg)_rotateX(3deg)_rotateZ(0.5deg)]">
            {error && !quotes ? (
              // Honest failure — never a placeholder quote.
              <div className="rounded-[28px] border border-[rgb(var(--azee-blue)/0.25)] bg-[rgb(var(--azee-panel))] px-6 py-14 text-center text-sm text-white/50 shadow-[0_30px_70px_-20px_rgba(2,5,18,0.95)]">
                Live prices are temporarily unavailable. Please try again
                shortly.
              </div>
            ) : loading && !quotes ? (
              <div className="rounded-[28px] border border-[rgb(var(--azee-blue)/0.25)] bg-[rgb(var(--azee-panel))] px-6 py-14 text-center text-sm text-white/50 shadow-[0_30px_70px_-20px_rgba(2,5,18,0.95)]">
                Loading live PSX prices…
              </div>
            ) : active ? (
              <QuoteCard quote={active} />
            ) : (
              <div className="rounded-[28px] border border-[rgb(var(--azee-blue)/0.25)] bg-[rgb(var(--azee-panel))] px-6 py-14 text-center text-sm text-white/50 shadow-[0_30px_70px_-20px_rgba(2,5,18,0.95)]">
                No PSX symbol matches “{query.trim()}”.
              </div>
            )}
            </div>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-white/35">
            Live prices from the PSX ready board, the same feed behind{" "}
            <Link
              to="/market-watch"
              className="text-white/55 underline decoration-white/20 underline-offset-4 transition-colors duration-300 hover:text-white"
            >
              Market Watch
            </Link>
            . Quotes are indicative and not an offer to trade.
          </p>
        </div>
      </div>
    </section>
  );
}
