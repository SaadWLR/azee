import { Link, useParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { IndexHistoryChart } from "./IndexHistoryChart";
import { useAllMarketQuotes, useIndexHistory } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { StockQuote } from "../types";

/**
 * One dynamic route (/market-watch/:symbol) for every PSX symbol.
 *
 * TWO INDEPENDENT FETCHES, deliberately not composed. The live quote
 * comes from the market-watch feed and is minutes old; the price
 * archive comes from PSX's EOD endpoint and is a day old. Waiting for
 * both would make the header sit blank while a 50KB archive downloads,
 * and an archive outage would blank a quote that arrived fine. They
 * fail, load and render separately.
 *
 * The quote hook is the same useAllMarketQuotes that Market Watch and
 * the homepage lookup already call, on the same URL — apiClient's dedup
 * layer means arriving here from Market Watch costs no second request.
 * The history hook is called WITHOUT a cache Map, which is the case its
 * own doc comment was written for: one symbol per page visit, nothing
 * to re-open.
 *
 * FOUR STATES, kept distinct. Loading, "we fetched the market and this
 * symbol is not in it", and "the fetch itself failed" are three
 * different situations, and collapsing the middle one into either of
 * the others would tell a visitor with a stale bookmark that something
 * is broken when nothing is.
 */

function fmtNum(value: number | undefined, dp = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

function fmtVolume(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/** Official index membership, never a religious ruling — see StockQuote. */
function membershipBadge(quote: StockQuote): string | null {
  if (quote.isKmi30) return "KMI-30";
  if (quote.isKmiAllShare) return "KMI All-Share";
  return null;
}

/** A page-shaped shell, so every state gets the same chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[rgb(var(--azee-navy))]">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Centered({
  eyebrow,
  heading,
  body,
  back,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  back?: boolean;
}) {
  return (
    <section className="section-tint-a relative px-4 pb-24 pt-[calc(var(--nav-height)+3rem)] sm:px-6 lg:px-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">{body}</p>
        {back ? (
          <Link
            to="/market-watch"
            className="liquid-glass mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/15"
          >
            ← Back to Market Watch
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function StockDetailPage() {
  const { symbol: raw } = useParams<{ symbol: string }>();
  // PSX symbols are uppercase; a lowercase URL is a valid way to arrive.
  const symbol = (raw ?? "").toUpperCase();

  const { data: quotes, loading, error } = useAllMarketQuotes();
  const quote = quotes?.find((q) => q.symbol === symbol);

  /*
   * The archive is requested regardless of whether the quote turned up.
   * A symbol that has stopped trading can still have years of history
   * worth looking at, and the two answers are independent.
   */
  const history = useIndexHistory(symbol);

  usePageMeta(
    quote?.name
      ? `${quote.symbol} — ${quote.name} | AZEE Trade`
      : quote
        ? `${quote.symbol} — PSX Share Price | AZEE Trade`
        : `${symbol || "Symbol"} not found | AZEE Trade`,
    quote
      ? `Live PSX share price and end-of-day price history for ${quote.name ?? quote.symbol}${quote.sector ? ` (${quote.sector})` : ""}. Data from the Pakistan Stock Exchange.`
      : `${symbol} is not among the symbols currently trading on the Pakistan Stock Exchange.`,
  );

  if (loading && !quotes) {
    return (
      <Shell>
        <Centered
          eyebrow="Pakistan Stock Exchange"
          heading={symbol}
          body="Loading live quotes…"
        />
      </Shell>
    );
  }

  /*
   * A failed fetch and an absent symbol are told apart here. Error is
   * checked first: with no quotes at all we cannot claim the symbol is
   * missing, only that we could not look.
   */
  if (error && !quotes) {
    return (
      <Shell>
        <Centered
          eyebrow="Pakistan Stock Exchange"
          heading={symbol}
          body="Market data is temporarily unavailable. Please try again shortly."
          back
        />
      </Shell>
    );
  }

  if (!quote) {
    return (
      <Shell>
        <Centered
          eyebrow="Pakistan Stock Exchange"
          heading="Symbol not found"
          body={`${symbol} is not among the symbols currently trading on the Pakistan Stock Exchange. It may have been delisted, or the link may be mistyped.`}
          back
        />
      </Shell>
    );
  }

  const badge = membershipBadge(quote);
  const up = quote.changePercent >= 0;
  const move = up ? "text-emerald-400" : "text-rose-400";

  return (
    <Shell>
      <section
        data-nav-theme-section="dark"
        className="section-tint-a relative px-4 pb-16 pt-[calc(var(--nav-height)+3rem)] sm:px-6 lg:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <Link
            to="/market-watch"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90 transition-colors duration-300 hover:text-blue-200"
          >
            ← Market Watch
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
              {quote.symbol}
            </h1>
            {badge ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-300">
                {badge}
              </span>
            ) : null}
          </div>

          {/* Name and sector come from a separate directory fetch and
              are simply absent when it has no entry — the ticker above
              already identifies the company, so a missing name costs
              nothing and a guessed one would cost a great deal. */}
          {quote.name ? (
            <p className="mt-2 text-base text-gray-300">{quote.name}</p>
          ) : null}
          {quote.sector ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-300/80">
              {quote.sector}
            </p>
          ) : null}

          {/* Live quote card. */}
          <div className="mt-8 rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-6 py-5">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Current
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight text-[rgb(var(--azee-chalk))]">
                  {fmtNum(quote.price)}
                  <span className="ml-2 text-sm font-semibold text-white/45">
                    PKR
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Change
                </p>
                <p className={`mt-1 text-xl font-bold tabular-nums leading-none ${move}`}>
                  {up ? "▲ +" : "▼ "}
                  {fmtNum(Math.abs(quote.changePercent))}%
                  {quote.changePoints !== undefined ? (
                    <span className="ml-2 text-sm font-semibold">
                      ({up ? "+" : "−"}
                      {fmtNum(Math.abs(quote.changePoints))})
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Volume
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                  {fmtVolume(quote.volume)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-white/45">
              Live prices from the PSX ready board, the same feed behind Market
              Watch. Quotes are indicative and not an offer to trade.
            </p>
          </div>

          {/* Price history — its own states, independent of the quote. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))]">
            {history.data?.points.length ? (
              <IndexHistoryChart points={history.data.points} />
            ) : (
              <div className="px-5 py-10 text-center text-xs text-gray-400">
                {history.loading
                  ? "Loading price history…"
                  : history.error
                    ? "Price history is temporarily unavailable."
                    : "No price history is published for this symbol."}
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
