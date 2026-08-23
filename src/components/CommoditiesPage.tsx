import { Fragment } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useCommodities } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { CommodityGroup, PmexCommodityQuote } from "../types";

/*
 * /commodities — PMEX commodity FUTURES.
 *
 * Its own route rather than a third tab on /indices: commodities are a
 * distinct asset class from equity indices, the same way Market Watch
 * and Corporate Calendar each earn their own page.
 *
 * Framing discipline (same as the Global Futures tab): these are futures
 * contracts listed on PMEX that reference the named commodity — NOT spot
 * commodity prices. Every row carries a "PMEX futures" label, the copy
 * says "Commodity Futures" throughout, and the note under the table
 * states the distinction plainly.
 */

/** Column labels; everything from index 2 on is right-aligned numeric. */
const COLUMNS = [
  "Commodity",
  "Contract",
  "Bid",
  "Ask",
  "Change",
  "Change %",
  "Volume",
  "High",
  "Low",
];

/*
 * Display order of the groups. The endpoint already tags each quote with
 * its group, so this only fixes the order they appear in — the grouping
 * itself comes from the data, never re-derived here.
 */
const GROUP_ORDER: CommodityGroup[] = ["Energy", "Metals", "Agriculture"];

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

export function CommoditiesPage() {
  usePageMeta(
    "PMEX Commodity Futures — Live Gold, Crude Oil & Metals | AZEE Trade",
    "Live PMEX commodity futures quotes — gold, silver, copper, platinum, palladium, aluminum, WTI and Brent crude, natural gas, wheat, corn, soybean and cotton — with bid, ask, change, volume and session high/low from the Pakistan Mercantile Exchange.",
  );

  const { data, loading, error } = useCommodities();
  const commodities = data?.commodities;
  const unavailable = data?.unavailable ?? [];

  // Group for display, preserving the endpoint's within-group order.
  const groups = GROUP_ORDER.map((group) => ({
    group,
    rows: (commodities ?? []).filter((c) => c.group === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Mercantile Exchange
          </p>
          <h1 className="font-display mt-3 text-[2.5rem] text-[rgb(var(--azee-chalk))] sm:text-5xl">
            Commodity Futures
          </h1>
          {/* Brand-signature stripe — same motif as the other page
              headings (mt-4 under this 3xl/4xl heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            PMEX commodity futures — contracts traded on the Pakistan
            Mercantile Exchange that reference international commodities
            across energy, metals and agriculture. These are futures
            prices, not spot commodity prices.
          </p>

          {/* Table / states — same liquid-glass card as Indices and
              Market Watch. */}
          <div className="liquid-glass glass-sheen mt-8 overflow-hidden rounded-3xl">
            {error && !commodities ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Commodity futures data is temporarily unavailable. Please try
                again shortly.
              </div>
            ) : loading && !commodities ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading live commodity futures…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
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
                    {groups.map(({ group, rows }) => (
                      <Fragment key={group}>
                        {/* Group divider row — keeps every group in one
                            column grid (values stay comparable across
                            groups) while reading as its own section. */}
                        <tr className="bg-white/[0.03]">
                          <th
                            scope="colgroup"
                            colSpan={COLUMNS.length}
                            className="border-y border-white/5 px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-300/80"
                          >
                            {group}
                          </th>
                        </tr>
                        {rows.map((c: PmexCommodityQuote) => (
                          <tr
                            key={c.contract}
                            className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                          >
                            <td className="px-5 py-3.5">
                              <span className="flex flex-col">
                                <span className="font-semibold tracking-wide text-white">
                                  {c.commodity}
                                </span>
                                <span className="text-xs text-gray-400">
                                  PMEX futures
                                </span>
                              </span>
                            </td>
                            <td className="px-5 py-3.5 tabular-nums text-gray-300">
                              {c.contract}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-white">
                              {fmtNum(c.bid)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtNum(c.ask)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums">
                              <ChangeCell value={c.changePoints} suffix="" />
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums">
                              <ChangeCell value={c.changePercent} suffix="%" />
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtVolume(c.volume)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtNum(c.high ?? undefined)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtNum(c.low ?? undefined)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {commodities && (
            <>
              {/*
               * If PMEX is not quoting one of the tracked commodities
               * right now, say so — the row is never zero-filled, and
               * its absence is never left unexplained.
               */}
              {unavailable.length > 0 && (
                <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                  <span className="font-semibold text-gray-300">
                    Not currently quoted:
                  </span>{" "}
                  {unavailable.join(", ")}. PMEX has no active contract for
                  {unavailable.length === 1 ? " it" : " these"} at the moment,
                  so {unavailable.length === 1 ? "it is" : "they are"} left out
                  rather than shown with placeholder values.
                </p>
              )}

              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                These are{" "}
                <span className="font-semibold text-gray-300">
                  futures contracts
                </span>{" "}
                listed on the Pakistan Mercantile Exchange (PMEX) — one of the
                two exchanges AZEE is a member of. Each references the named
                commodity (e.g. gold, WTI crude); the prices shown are the PMEX
                futures bid/ask for the contract named in the Contract column,
                not the spot price of the commodity. Contracts roll over
                between expiries, so the symbol shown is the currently active
                one. High and low show &ldquo;—&rdquo; when PMEX has not
                reported a session range for a thinly-traded contract.
              </p>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
