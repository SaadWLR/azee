import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllMarketQuotes } from "../hooks/useMarketData";
import type { StockQuote } from "../types";

/**
 * Homepage conversion section — "Start investing".
 *
 * THE INTERACTIVE ELEMENT: a real, working PSX symbol lookup. A visitor
 * types a ticker or company name and gets that company's actual live
 * price, change and volume off the PSX ready board. Nothing here is a
 * mockup or a canned demo — it is the same data the Market Watch page
 * serves, and if PSX is down this says so rather than inventing a quote.
 *
 * WHY A LOOKUP: the section asks someone to open a trading account. The
 * most honest argument for doing that is the product itself working in
 * front of them, on their own choice of symbol. A screenshot shows what
 * the product looked like once; this IS the product.
 *
 * NO NEW POLLING. useAllMarketQuotes is the SAME hook and the SAME
 * /api/market/watch URL the homepage ticker already runs, on the same
 * 75s cadence. Both mount in the same render commit, so their polls
 * land inside apiClient's dedup window and share one request — the
 * pattern that layer was built for. No new Vercel function, no second
 * cadence.
 *
 * NO VIDEO. The night-city footage that used to be this section's
 * background is deliberately dropped, not overlooked: a looping video
 * behind a panel of small live numbers competes with the thing the
 * visitor is meant to read, and the interactive lookup now occupies the
 * visual role the footage was filling. The Hero keeps its own video and
 * is untouched.
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

/** The live quote card for one symbol. */
function QuoteCard({ quote }: { quote: StockQuote }) {
  const up = quote.changePercent >= 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-wide text-white">
            {quote.symbol}
          </p>
          {quote.name && (
            <p className="mt-0.5 truncate text-sm text-gray-400">
              {quote.name}
            </p>
          )}
          {quote.sector && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              {quote.sector}
            </p>
          )}
        </div>
        {(quote.isKmi30 || quote.isKmiAllShare) && (
          <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-300">
            {quote.isKmi30 ? "KMI-30" : "KMI All-Share"}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-4xl font-bold tabular-nums tracking-tight text-white">
          {fmtPrice(quote.price)}
          <span className="ml-2 text-sm font-medium text-gray-500">PKR</span>
        </p>
        <p
          className={`text-right text-sm font-semibold tabular-nums ${
            up ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <span className="block text-lg">
            {up ? "▲ +" : "▼ "}
            {Math.abs(quote.changePercent).toFixed(2)}%
          </span>
          {quote.changePoints !== undefined && (
            <span className="mt-0.5 block text-xs opacity-80">
              {up ? "+" : "−"}
              {fmtPrice(Math.abs(quote.changePoints))} pts
            </span>
          )}
        </p>
      </div>

      <dl className="mt-5 flex items-center gap-6 border-t border-white/10 pt-4">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            Volume
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-gray-200">
            {fmtVolume(quote.volume)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            Exchange
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-gray-200">PSX</dd>
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

  return (
    <section
      id="start-investing"
      className="relative w-full overflow-hidden bg-black py-24 sm:py-28"
    >
      {/*
       * EMBER TREATMENT — this section's own colour moment.
       *
       * Every other section on the site tints with --azee-navy (see
       * .section-tint-a / -b), so the whole scroll reads cool blue. Here
       * the ambient glow is --azee-orange instead: the same brand token
       * already used for the signature stripe and the Stats figures,
       * but leading rather than accenting. Orange is the palette's
       * action colour, so the one section asking the visitor to act is
       * the one place it dominates — a warm band in a cool page, marking
       * "this is where you do something". A navy counterweight is kept
       * on the opposite corner so it stays in family rather than
       * becoming a different site.
       */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_65%_60%_at_15%_30%,rgb(var(--azee-orange)/0.22),transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_88%_85%,rgb(var(--azee-navy)/0.65),transparent_70%)]"
      />
      {/* Warm hairlines, where the rest of the site uses blue. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--azee-orange)/0.5)] to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--azee-orange)/0.25)] to-transparent"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-12">
        {/* ── Copy + CTA ─────────────────────────────────────────── */}
        <div>
          <p
            className="closing-fade-up text-xs font-semibold uppercase tracking-[0.25em] text-[rgb(var(--azee-orange))]"
            style={{ animationDelay: "0.1s" }}
          >
            Start investing
          </p>

          <h2 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            <span className="closing-fade-up block" style={{ animationDelay: "0.25s" }}>
              The market's live.
            </span>
            <span className="closing-fade-up block" style={{ animationDelay: "0.4s" }}>
              Make your move.
            </span>
          </h2>

          <div
            className="closing-fade-up mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]"
            style={{ animationDelay: "0.5s" }}
          />

          <p
            className="closing-fade-up mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg"
            style={{ animationDelay: "0.55s" }}
          >
            Look up any company on the Pakistan Stock Exchange — the prices
            beside this are live, the same feed our Market Watch runs on. Open
            an AZEE account to trade them.
          </p>

          <div
            className="closing-fade-up mt-9 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.7s" }}
          >
            {/*
             * The site's only solid-orange button. Every other CTA is
             * glass or white, so the primary conversion action is
             * visually unique rather than one more button.
             */}
            <Link
              to="/get-started"
              className="rounded-full bg-[rgb(var(--azee-orange))] px-9 py-4 text-center text-[15px] font-semibold text-white shadow-[0_10px_36px_rgb(var(--azee-orange)/0.35)] transition-all duration-300 hover:scale-[1.04] hover:bg-[rgb(var(--azee-orange)/0.9)] active:scale-[0.98] sm:w-auto"
            >
              Open a Trading Account
            </Link>
            <Link
              to="/market-watch"
              className="closing-glass rounded-full px-8 py-4 text-center text-[15px] font-semibold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
            >
              See all {quotes?.length ?? ""} symbols
            </Link>
          </div>
        </div>

        {/* ── The live lookup ────────────────────────────────────── */}
        <div
          className="closing-fade-up liquid-glass rounded-3xl p-5 sm:p-6"
          style={{ animationDelay: "0.45s" }}
        >
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--azee-orange)/0.9)]">
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[rgb(var(--azee-orange)/0.5)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--azee-orange)/0.35)]"
            />
          </label>

          {/* Most-active chips, derived from the same live payload. */}
          {suggestions.length > 0 && !term && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
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
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                    picked === q.symbol
                      ? "bg-[rgb(var(--azee-orange))] text-white"
                      : "border border-white/10 bg-white/[0.06] text-gray-300 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {q.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Matches for what is being typed. */}
          {term && matches.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {matches.map((q) => (
                <button
                  key={q.symbol}
                  type="button"
                  onClick={() => {
                    setPicked(q.symbol);
                    setQuery("");
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors duration-300 hover:bg-white/15 hover:text-white"
                >
                  {q.symbol}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5">
            {error && !quotes ? (
              // Honest failure — never a placeholder quote.
              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-10 text-center text-sm text-gray-400">
                Live prices are temporarily unavailable. Please try again
                shortly.
              </div>
            ) : loading && !quotes ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-10 text-center text-sm text-gray-400">
                Loading live PSX prices…
              </div>
            ) : active ? (
              <QuoteCard quote={active} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-10 text-center text-sm text-gray-400">
                No PSX symbol matches “{query.trim()}”.
              </div>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            Live prices from the PSX ready board, the same feed behind{" "}
            <Link
              to="/market-watch"
              className="text-gray-400 underline decoration-white/20 underline-offset-4 transition-colors duration-300 hover:text-white hover:decoration-white/50"
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
