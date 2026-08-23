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
  const gold = data?.gold;

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Foreign Exchange
          </p>
          {/* Matches the top-level nav label: the page carries both
              currency rates and the local gold estimate below. */}
          <h1 className="font-display mt-3 text-[2.5rem] text-[rgb(var(--azee-chalk))] sm:text-5xl">
            Forex &amp; Commodities
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

          {/*
           * Local gold estimate — a second table under the currency
           * table rather than a tab or a separate route. It belongs on
           * this page (both are "what is this worth in rupees today"),
           * but it is a fundamentally weaker number than the currency
           * rates above it, so it needs its own heading and its own
           * caveats sitting directly against it. A tab would hide that
           * distinction behind a click; stacking keeps the currency
           * rates and the estimate visibly separate but adjacent.
           */}
          {gold && (
            <div className="mt-14">
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Local Gold — Estimated
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
                A calculated estimate, not a market quote. Pakistan&apos;s local
                gold rate is set once daily by the Karachi Sarafa Bazaar; we do
                not receive that rate. The figures below are worked out from the
                international gold price and the US Dollar rate, so treat them
                as a guide to roughly where the market sits, not as a price you
                can transact at.
              </p>

              <div className="liquid-glass glass-sheen mt-6 overflow-hidden rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-blue-200/15 text-left">
                        {["Metal", "Unit", "Estimated range (PKR)"].map(
                          (label, i) => (
                            <th
                              key={label}
                              scope="col"
                              className={`px-5 py-3.5 font-semibold text-gray-300 ${
                                i === 2 ? "text-right" : "text-left"
                              }`}
                            >
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { unit: "1 tola", lo: gold.lowPkrPerTola, hi: gold.highPkrPerTola },
                        {
                          unit: "10 grams",
                          lo: (gold.lowPkrPerTola / 11.6638) * 10,
                          hi: (gold.highPkrPerTola / 11.6638) * 10,
                        },
                      ].map((row) => (
                        <tr
                          key={row.unit}
                          className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                        >
                          <td className="px-5 py-3.5 text-gray-300">
                            Gold (24K)
                          </td>
                          <td className="px-5 py-3.5 font-semibold tracking-wide text-white">
                            {row.unit}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-white">
                            {Math.round(row.lo).toLocaleString("en-US")}
                            <span className="mx-1.5 text-gray-500">–</span>
                            {Math.round(row.hi).toLocaleString("en-US")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                <span className="font-semibold text-gray-300">
                  How this is worked out:
                </span>{" "}
                international spot gold ({gold.spotUsdPerOz.toLocaleString("en-US")}{" "}
                USD/oz as at {gold.spotAsOf}) × the US Dollar rate above ×
                the troy-ounce-to-tola conversion, giving{" "}
                {gold.basePkrPerTola.toLocaleString("en-US")} PKR/tola before any
                local margin. Local dealers price above that: we measured{" "}
                {gold.premiumLowPct}–{gold.premiumHighPct}% on the days we
                checked, which is the range shown. That margin is not fixed and
                we have not established it as stable, which is why this is shown
                as a range and not a single figure.
              </p>
              <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                Actual Sarafa Bazaar and jewellers&apos; rates will differ, and
                will also vary by city, by dealer, and with making charges. For a
                rate you can act on, check with your local Sarafa market or
                dealer.
              </p>
            </div>
          )}

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
