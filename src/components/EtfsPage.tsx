import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useEtfs } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { EtfQuote } from "../types";

/*
 * /etfs — every Exchange Traded Fund listed on the PSX.
 *
 * Flat route matching the existing /market-watch, /indices,
 * /commodities convention. Deliberately NOT nested under a
 * mutual-funds path: mutual funds are a separate instrument with a
 * separate data source, and a later milestone can add them alongside
 * (as a sibling route or a tab here) without this URL having to change.
 *
 * Reuses the Market Watch / Indices liquid-glass table language — no
 * new visual vocabulary.
 */

/** Column labels; everything from index 2 on is right-aligned numeric. */
const COLUMNS = [
  "Symbol",
  "Fund",
  "High",
  "Low",
  "LDCP",
  "Current",
  "Change",
  "Change %",
  "Volume",
];

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

function ChangeCell({
  value,
  suffix,
}: {
  value: number | undefined;
  suffix: string;
}) {
  if (value === undefined || !Number.isFinite(value)) {
    return <span className="text-gray-500">—</span>;
  }
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-400" : "text-rose-400"}>
      {up ? "▲ +" : "▼ "}
      {fmtNum(Math.abs(value))}
      {suffix}
    </span>
  );
}

export function EtfsPage() {
  usePageMeta(
    "PSX ETFs — Live Exchange Traded Fund Prices | AZEE Trade",
    "Live prices for every Exchange Traded Fund listed on the Pakistan Stock Exchange — current price, session high and low, last day close, change and traded volume for all PSX-listed ETFs.",
  );

  const { data, loading, error } = useEtfs();
  const etfs = data?.etfs;
  const stale = data?.stale;

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Stock Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Exchange Traded Funds
          </h1>
          {/* Brand-signature stripe — same motif as the other page
              headings (mt-4 under this 3xl/4xl heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Live prices for every ETF listed on the Pakistan Stock Exchange.
            ETFs trade on the exchange like ordinary shares, so these are real
            traded prices with a session high, low and volume — not once-daily
            NAV valuations. Data from the Pakistan Stock Exchange.
          </p>

          {/* Table / states — same liquid-glass card as Market Watch and
              Indices. A failed fetch shows an explicit message; the table
              is never rendered empty or partially. */}
          <div className="liquid-glass glass-sheen mt-8 overflow-hidden rounded-3xl">
            {error && !etfs ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                ETF data is temporarily unavailable. Please try again shortly.
              </div>
            ) : loading && !etfs ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading live ETF prices…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      {COLUMNS.map((label, i) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-5 py-3.5 font-semibold text-gray-300 ${
                            i >= 2 ? "text-right" : "text-left"
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(etfs ?? []).map((etf: EtfQuote) => (
                      <tr
                        key={etf.symbol}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-3.5 font-semibold tracking-wide text-white">
                          {etf.symbol}
                        </td>
                        <td className="px-5 py-3.5 text-gray-300">{etf.name}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                          {fmtNum(etf.high)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                          {fmtNum(etf.low)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                          {fmtNum(etf.ldcp)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-white">
                          {fmtNum(etf.price)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          <ChangeCell value={etf.changePoints} suffix="" />
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          <ChangeCell value={etf.changePercent} suffix="%" />
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                          {fmtVolume(etf.volume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {etfs && (
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
              {stale && (
                <>
                  <span className="font-semibold text-gray-300">
                    Showing the last confirmed prices —
                  </span>{" "}
                  live PSX data is temporarily unavailable, so these may be
                  behind the market.{" "}
                </>
              )}
              ETFs are classified using the Pakistan Stock Exchange&apos;s own
              sector code for exchange traded funds, so this list is whatever
              PSX currently classifies as an ETF — not a guess from ticker
              names. LDCP is the last day closing price, the reference the
              day&apos;s change is measured from. Mutual funds are priced at
              NAV and do not trade on the exchange, so they are not shown here.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
