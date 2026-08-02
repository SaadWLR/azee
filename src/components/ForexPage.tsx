import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useForex } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { ForexRate } from "../types/forex";

/*
 * /forex — mid-market PKR reference rates.
 *
 * The copy here carries real weight. These are NOT open-market money
 * changer rates and have no bid/ask spread, so every visible label says
 * "mid-market reference rate" and the page states plainly that a
 * counter will quote something different. Same
 * factual-not-overstated discipline as the PMEX futures-vs-spot pages.
 *
 * The timestamp shown is the SOURCE's own, passed through untouched —
 * never our fetch time. Reuses the ETFs / Commodities liquid-glass
 * table language; no new visual vocabulary.
 */

const COLUMNS = ["Currency", "Code", "Rate (PKR)"];

/** "Fri, 31 Jul 2026 00:02:31 +0000" → "31 Jul 2026, 05:02 PKT". */
function formatSourceTime(raw: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw; // show it verbatim rather than guess
  return `${new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  })} PKT`;
}

/** JPY is ~1.7 PKR; USD ~277. Four decimals reads correctly for both. */
function fmtRate(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  });
}

export function ForexPage() {
  usePageMeta(
    "Forex — Live PKR Exchange Rates | AZEE Trade",
    "Mid-market reference exchange rates for the Pakistani Rupee against the US Dollar, British Pound, Euro, UAE Dirham, Saudi Riyal, Australian Dollar, Canadian Dollar and Japanese Yen.",
  );

  const { data, loading, error } = useForex();
  const rates = data?.rates;
  const stale = data?.stale;

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Foreign Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            PKR Exchange Rates
          </h1>
          {/* Brand-signature stripe — same motif as the other page
              headings (mt-4 under this 3xl/4xl heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Mid-market reference rates for the Pakistani Rupee — the midpoint
            between global buy and sell prices, the same benchmark used by
            services like Google Finance. These are not open-market or money
            changer rates, and they carry no buy/sell spread.
          </p>

          <div className="liquid-glass glass-sheen mt-8 overflow-hidden rounded-3xl">
            {error && !rates ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Exchange rates are temporarily unavailable. Please try again
                shortly.
              </div>
            ) : loading && !rates ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading exchange rates…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      {COLUMNS.map((label, i) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-5 py-3.5 font-semibold text-gray-300 ${
                            i === 2 ? "text-right" : "text-left"
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(rates ?? []).map((r: ForexRate) => (
                      <tr
                        key={r.code}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-3.5 text-gray-300">{r.name}</td>
                        <td className="px-5 py-3.5 font-semibold tracking-wide text-white">
                          {r.code}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-white">
                          {fmtRate(r.pkrPerUnit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data && (
            <>
              {/*
               * The source's own publication time, verbatim — not when
               * this page loaded. The source updates once daily, so a
               * timestamp that moved on every visit would imply a
               * freshness the data does not have.
               */}
              <p className="mt-5 text-xs text-gray-400 tabular-nums">
                <span className="font-semibold text-gray-300">
                  Rates published by the source:
                </span>{" "}
                {formatSourceTime(data.sourceUpdatedAt)}
                {data.sourceNextUpdateAt && (
                  <> · next update {formatSourceTime(data.sourceNextUpdateAt)}</>
                )}
              </p>

              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                {stale && (
                  <>
                    <span className="font-semibold text-gray-300">
                      Showing the last confirmed rates —
                    </span>{" "}
                    the rate source is temporarily unavailable. The publication
                    time above is still the source&apos;s own, so it reflects
                    when these figures were actually issued.{" "}
                  </>
                )}
                These are{" "}
                <span className="font-semibold text-gray-300">
                  mid-market reference rates
                </span>
                , updated once daily by the source. A bank, exchange company or
                money changer will quote a different rate — typically a rupee or
                more away on the US Dollar — because their price includes a
                buy/sell spread and their own margin. Use these for reference,
                not as the rate you will be offered at a counter.{" "}
                {data.attribution}.
              </p>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
