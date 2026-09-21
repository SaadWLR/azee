import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { IndexHistoryChart } from "./IndexHistoryChart";
import { useAllMarketQuotes, useIndexHistory } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import { rsi, rsiZone, sma } from "../lib/indicators";
import type { StockQuote } from "../types";
import type { EodPoint } from "../types/history";

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

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The trailing window "52-week" means here, in calendar days. */
const YEAR_DAYS = 365;
/**
 * A window whose oldest session is younger than this is reported by the
 * span it actually has, rather than called a 52-week range it cannot
 * cover — a symbol listed three months ago has a three-month range.
 */
const NEAR_YEAR_DAYS = 350;

interface ClosingRange {
  low: number;
  high: number;
  sessions: number;
  from: string;
  to: string;
  coversYear: boolean;
}

/**
 * The trailing-year high and low, computed here from the EOD archive the
 * chart on this page already loaded — no second fetch, and no backend
 * field for it.
 *
 * CLOSING PRICES, and labelled that way in the UI. The archive carries
 * one close per session rather than each session's high and low, so a
 * true intraday 52-week high is not derivable from what this page holds.
 * Calling a closing extreme "the 52-week high" would overstate it by
 * whatever the highest intraday spike added.
 *
 * The card says what AZEE computed and from what, and deliberately makes
 * no claim about what other sources publish. It once said "PSX publishes
 * no rolling 52-week extreme", which was false: PSX's company pages do
 * publish one (checked 2026-09-21). That page is not used here — its
 * data is gated on an open licensing question — and no comparison is
 * implied either way, though for one thin stock (PRWM) its stated low
 * sat above 191 of the year's 220 closes in this same archive.
 *
 * The window is counted in calendar days from the newest session, the
 * same convention IndexHistoryChart's range tabs use, so the "1Y" chart
 * and this range describe the same stretch of time.
 */
function closingRange(points: EodPoint[] | undefined): ClosingRange | null {
  if (!points || points.length < 2) return null;
  const to = points[points.length - 1].date;
  const cutoff = new Date(`${to}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - YEAR_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const window = points.filter((p) => p.date >= cutoffIso);
  // Two points is the floor for a range to mean anything at all.
  if (window.length < 2) return null;

  const closes = window.map((p) => p.close);
  const spanDays =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${window[0].date}T00:00:00Z`)) /
    86_400_000;
  return {
    low: Math.min(...closes),
    high: Math.max(...closes),
    sessions: window.length,
    from: window[0].date,
    to,
    coversYear: spanDays >= NEAR_YEAR_DAYS,
  };
}

/** Sessions each indicator needs before it means what its name says. */
const SMA_SHORT = 50;
const SMA_LONG = 200;
const RSI_PERIOD = 14;

interface Indicators {
  sessions: number;
  asOf: string;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
}

/**
 * The indicators for a symbol, from the archive this page already has.
 *
 * Each entry is either a number or null, and null is rendered as the
 * reason it is missing rather than a dash — a symbol listed this year
 * has no 200-session average, which is a fact about the listing, not a
 * failure of the page.
 */
function indicators(points: EodPoint[] | undefined): Indicators | null {
  if (!points || points.length < 2) return null;
  return {
    sessions: points.length,
    asOf: points[points.length - 1].date,
    sma50: sma(points, SMA_SHORT),
    sma200: sma(points, SMA_LONG),
    rsi14: rsi(points, RSI_PERIOD),
  };
}

/**
 * How many sector peers the list shows. Some PSX sectors run past 30
 * names (Commercial Banks, Textile Composite), and a detail page is not
 * a second Market Watch — the cap keeps this a glance, and the line
 * under the list says how many were left out rather than hiding it.
 */
const PEER_CAP = 8;

/**
 * Peers ordered by the size of today's move, largest first.
 *
 * Alphabetical would be arbitrary here, and share volume is not
 * comparable across a 12-rupee share and a 1,400-rupee one — millions of
 * shares of the first is a quieter session than thousands of the second,
 * and this feed carries no traded VALUE to rank by. The size of the move
 * is the one thing that is comparable between two names in the same
 * sector, and it answers what someone reading this page is asking: what
 * else in this sector is doing something today. Direction is kept in the
 * row (each peer shows its own sign), so this ranks by magnitude without
 * flattening gainers and losers together.
 */
function sectorPeers(
  quotes: StockQuote[] | null | undefined,
  quote: StockQuote | undefined,
): StockQuote[] {
  if (!quotes || !quote?.sector) return [];
  return quotes
    .filter((q) => q.sector === quote.sector && q.symbol !== quote.symbol)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/** A page-shaped shell, so every state gets the same chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
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

  /*
   * Both derived from data already on the page — the archive the chart
   * drew, and the same quote list the header read. Memoised because each
   * walks a few hundred (peers) or a few thousand (archive) entries, and
   * neither depends on anything that changes between renders.
   */
  const range = useMemo(() => closingRange(history.data?.points), [history.data]);
  const technicals = useMemo(() => indicators(history.data?.points), [history.data]);
  const peers = useMemo(() => sectorPeers(quotes, quote), [quotes, quote]);

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
              {/* The session in the order it happened: where it closed
                  last time, where it opened, how far it travelled. Each
                  appears only when PSX published it — see StockQuote: a
                  0 in these columns means "no range", not a price, and a
                  symbol can trade without one. */}
              {quote.previousClose !== undefined ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Previous close
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                    {fmtNum(quote.previousClose)}
                  </p>
                </div>
              ) : null}
              {quote.open !== undefined ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Open
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                    {fmtNum(quote.open)}
                  </p>
                </div>
              ) : null}
              {quote.dayLow !== undefined && quote.dayHigh !== undefined ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Day range
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                    {fmtNum(quote.dayLow)}
                    <span className="mx-1.5 text-sm font-semibold text-white/40">–</span>
                    {fmtNum(quote.dayHigh)}
                  </p>
                </div>
              ) : null}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-white/45">
              Live prices from the PSX ready board, the same feed behind Market
              Watch. Quotes are indicative and not an offer to trade.
            </p>
          </div>

          {/* Trailing-year range, from the archive below. Absent while
              that archive is loading or if it holds too few sessions to
              describe a range — never a figure from one data point. */}
          {range ? (
            <div className="mt-6 rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {range.coversYear
                  ? "52-week range"
                  : `Range since ${fmtDate(range.from)}`}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                {fmtNum(range.low)}
                <span className="mx-1.5 text-sm font-semibold text-white/40">–</span>
                {fmtNum(range.high)}
                <span className="ml-2 text-sm font-semibold text-white/45">PKR</span>
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                Computed by AZEE from the highest and lowest CLOSING price across{" "}
                {range.sessions} sessions of the Pakistan Stock Exchange&apos;s
                end-of-day archive, {fmtDate(range.from)} to {fmtDate(range.to)}.
                Closes only, so a session may have traded above or below this
                range intraday.
              </p>
            </div>
          ) : null}

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

          {/* Technical indicators, from the same archive the chart drew.
              Numbers only: where each one sits, never what to do about
              it. See src/lib/indicators.ts. */}
          {technicals ? (
            <section className="mt-6 rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-6 py-5">
              <h2 className="text-sm font-semibold text-[rgb(var(--azee-chalk))]">
                Technical indicators
              </h2>
              <div className="mt-4 flex flex-wrap gap-x-10 gap-y-5">
                {[
                  { label: `SMA-${SMA_SHORT}`, value: technicals.sma50, needs: SMA_SHORT },
                  { label: `SMA-${SMA_LONG}`, value: technicals.sma200, needs: SMA_LONG },
                ].map((entry) => (
                  <div key={entry.label} className="min-w-[8rem]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      {entry.label}
                    </p>
                    {entry.value !== null ? (
                      <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                        {fmtNum(entry.value)}
                        <span className="ml-2 text-sm font-semibold text-white/45">PKR</span>
                      </p>
                    ) : (
                      /* Said plainly, with both numbers, so the gap reads
                         as this symbol's short archive rather than a
                         broken page. */
                      <p className="mt-1.5 max-w-[15rem] text-[11px] leading-relaxed text-white/45">
                        Needs {entry.needs} sessions; this archive has{" "}
                        {technicals.sessions.toLocaleString("en-US")}.
                      </p>
                    )}
                  </div>
                ))}
                <div className="min-w-[8rem]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    RSI-{RSI_PERIOD}
                  </p>
                  {technicals.rsi14 !== null ? (
                    <>
                      <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]">
                        {fmtNum(technicals.rsi14)}
                      </p>
                      {/*
                       * Where the number sits on RSI's own 0–100 scale,
                       * in RSI's own published vocabulary. It describes
                       * the reading, and deliberately stops there: no
                       * verdict is drawn from it here or anywhere else.
                       */}
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                        {rsiZone(technicals.rsi14) === "overbought"
                          ? "Above 70, the zone conventionally called overbought."
                          : rsiZone(technicals.rsi14) === "oversold"
                            ? "Below 30, the zone conventionally called oversold."
                            : "Between 30 and 70, outside the conventional overbought and oversold zones."}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 max-w-[15rem] text-[11px] leading-relaxed text-white/45">
                      Needs {RSI_PERIOD + 1} sessions; this archive has{" "}
                      {technicals.sessions.toLocaleString("en-US")}.
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-white/45">
                Computed by AZEE from the Pakistan Stock Exchange&apos;s published
                closing prices — PSX does not publish these figures. SMA-
                {SMA_SHORT} and SMA-{SMA_LONG} are the mean closing price of the
                last {SMA_SHORT} and {SMA_LONG} sessions; RSI-{RSI_PERIOD} uses
                Wilder&apos;s smoothing over {RSI_PERIOD} sessions. All three run
                to the close of {fmtDate(technicals.asOf)} and do not include the
                live price above. Information only, not investment advice.
              </p>
            </section>
          ) : null}

          {/* Sector peers. Absent entirely — not an empty card — when the
              symbol has no sector (the directory fetch carries it, and it
              is optional) or is alone in its own. */}
          {peers.length ? (
            <section className="mt-6 rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-6 py-5">
              <h2 className="text-sm font-semibold text-[rgb(var(--azee-chalk))]">
                Others in {quote.sector}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                {peers.length > PEER_CAP
                  ? `The ${PEER_CAP} biggest moves today of the ${peers.length} other symbols in this sector.`
                  : `All ${peers.length} other ${peers.length === 1 ? "symbol" : "symbols"} in this sector, biggest move today first.`}
              </p>
              <ul className="mt-4 divide-y divide-white/8">
                {peers.slice(0, PEER_CAP).map((peer) => {
                  const peerUp = peer.changePercent >= 0;
                  return (
                    <li key={peer.symbol}>
                      <Link
                        to={`/market-watch/${peer.symbol}`}
                        className="flex items-center gap-4 py-2.5 transition-colors duration-300 hover:bg-white/5"
                      >
                        <span className="w-24 shrink-0 text-sm font-semibold text-[rgb(var(--azee-chalk))]">
                          {peer.symbol}
                        </span>
                        {/* The name is a bonus here too: absent when the
                            directory has no entry, never guessed. */}
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
                          {peer.name ?? ""}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[rgb(var(--azee-chalk))]">
                          {fmtNum(peer.price)}
                        </span>
                        <span
                          className={`w-20 shrink-0 text-right text-sm font-semibold tabular-nums ${
                            peerUp ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {peerUp ? "▲ +" : "▼ "}
                          {fmtNum(Math.abs(peer.changePercent))}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {peers.length > PEER_CAP ? (
                <Link
                  to="/market-watch"
                  className="mt-4 inline-block text-xs font-semibold text-blue-300/90 transition-colors duration-300 hover:text-blue-200"
                >
                  Search {quote.sector} in Market Watch →
                </Link>
              ) : null}
            </section>
          ) : null}

          {/* Announcements already filter by symbol; this is that filter
              pre-applied, not a new view. */}
          <Link
            to={`/announcements?symbol=${encodeURIComponent(quote.symbol)}`}
            className="liquid-glass mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/15"
          >
            Company announcements for {quote.symbol} →
          </Link>
        </div>
      </section>
    </Shell>
  );
}
