import { useId, type ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useEconomicDashboard } from "../hooks/useEconomicDashboard";
import type {
  CpiValues,
  DebtServicingValues,
  EconomicDashboardReady,
  ExternalDebtValues,
  FxReservesValues,
  GdpGrowthValues,
  Indicator,
  IndicatorFrequency,
  PolicyRateValues,
  RemittancesValues,
  TradeValues,
} from "../types/economic-dashboard";

/*
 * /economic-dashboard — Pakistan's headline macro indicators, from
 * /api/economic/dashboard (a daily snapshot of SBP EasyData).
 *
 * The page renders the API's honesty rules instead of smoothing them
 * over, because a dashboard is exactly the surface where a number gets
 * taken as fact:
 *
 *  - Response level: "pending" (the first daily run hasn't written yet),
 *    "ready", or a failed fetch — each in its own words.
 *  - Indicator level: fresh, stale and unavailable look different. A
 *    stale indicator shows its last confirmed figures dimmed and says
 *    since when it hasn't been readable; an unavailable one shows no
 *    figure at all rather than an empty or zero-looking one.
 *  - Two dates that answer different questions stay apart: the
 *    snapshot's `updatedAt` (when we last collected) sits above the
 *    cards, and each card carries its own period (what the figure
 *    describes — GDP's lags CPI's by months, by design).
 *  - Debt servicing is three SBP subtotals and NOTHING is added up here;
 *    SBP publishes no overall figure and the parts don't combine into
 *    one cleanly. The reserves total is the one computed number, and it
 *    is shown apart from the published ones with the API's own formula.
 *  - The policy rate's date is the date of its last CHANGE. EasyData
 *    publishes no MPC-decision date, and a hold never moves this one.
 *
 * Same liquid-glass cards, eyebrow and brand stripe as before and as the
 * other data pages — the data source changed, the visual language didn't.
 */

/** "2026-09-13T18:59:23.689Z" → "13 Sep 2026, 23:59 PKT". */
function formatPkt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso; // show it verbatim rather than guess
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

/** "2026-04-28" → "28 Apr 2026". A calendar date — never shifted by a time zone. */
function formatDay(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return isoDate;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** SBP's own precision, capped at two decimals for display. */
function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Percent({ value }: { value: number }) {
  return <>{formatNumber(value)}%</>;
}

function MillionUsd({ value }: { value: number }) {
  return (
    <>
      {formatNumber(value)}{" "}
      <span className="text-xs font-normal text-gray-500">million USD</span>
    </>
  );
}

/**
 * What a card's figures describe, in words. The period label itself is
 * SBP's, verbatim ("Aug-2026", "2026", …).
 */
function describePeriod(frequency: IndicatorFrequency, label: string): string {
  switch (frequency) {
    case "monthly":
      return `Figures for ${label} (monthly)`;
    case "quarterly":
      return `Figures for the quarter ending ${label}`;
    case "fiscal-year":
      return `Figures for fiscal year ${label} (July–June)`;
    case "as-needed":
      return "Changes only when SBP moves the rate";
  }
}

const LINK =
  "text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300";

/** Label/value rows — published figures only. */
function Figures({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-white/5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0"
        >
          <dt className="text-sm text-gray-400">{row.label}</dt>
          <dd className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-white">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface IndicatorCardProps<T> {
  title: string;
  indicator: Indicator<T>;
  /** Spans both grid columns — for cards carrying several figures. */
  wide?: boolean;
  children: (values: T) => ReactNode;
  note?: ReactNode;
}

function IndicatorCard<T>({ title, indicator, wide, children, note }: IndicatorCardProps<T>) {
  const headingId = useId();
  return (
    <article
      aria-labelledby={headingId}
      className={`liquid-glass glass-sheen rounded-3xl px-6 py-6 ${wide ? "sm:col-span-2" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 id={headingId} className="text-base font-semibold text-white">
          {title}
        </h3>
        {indicator.status === "stale" && (
          <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-200">
            Not current
          </span>
        )}
        {indicator.status === "unavailable" && (
          <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-gray-300">
            Not yet available
          </span>
        )}
      </div>

      {indicator.status === "unavailable" ? (
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Our daily update has not yet been able to read this indicator from
          SBP EasyData, so there is no figure to show. It will appear after the
          next successful update. Last attempted{" "}
          {formatPkt(indicator.lastAttemptAt)}.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-blue-200/80">
            {describePeriod(indicator.frequency, indicator.periodLabel)}
          </p>
          {/* A stale reading is still the last confirmed one, so it stays
              readable — dimmed, with the reason directly beneath it. */}
          <div className={`mt-4 ${indicator.status === "stale" ? "opacity-60" : ""}`}>
            {children(indicator.values)}
          </div>
          {indicator.status === "stale" && (
            <p className="mt-4 text-xs leading-relaxed text-amber-200/90">
              <span className="font-semibold">Showing the last confirmed figures —</span>{" "}
              our daily update has not been able to read this from SBP EasyData
              since {formatPkt(indicator.staleSince)}, so they may be out of
              date. They were collected {formatPkt(indicator.fetchedAt)}.
            </p>
          )}
          {note && (
            <div className="mt-4 text-xs leading-relaxed text-gray-400">{note}</div>
          )}
          <p className="mt-4 text-xs text-gray-500">
            Source:{" "}
            <a
              href={indicator.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              SBP EasyData
            </a>
          </p>
        </>
      )}
    </article>
  );
}

function IndicatorGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
        {heading}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Indicators({ snapshot }: { snapshot: EconomicDashboardReady }) {
  const { indicators } = snapshot;
  return (
    <>
      {/*
       * When WE last collected — deliberately not next to any card, and
       * worded differently from the cards' periods, because it answers a
       * different question: a figure collected tonight can describe a
       * quarter that ended in March.
       */}
      <div className="mt-8 text-xs leading-relaxed text-gray-400">
        <p className="tabular-nums">
          <span className="font-semibold text-gray-300">
            Last collected from SBP EasyData:
          </span>{" "}
          {formatPkt(snapshot.updatedAt)}
        </p>
        <p className="mt-1">
          Collected once a day. Each card shows the period its figures
          describe, which follows SBP&apos;s release schedule rather than
          the collection time — so GDP trails inflation by months.
        </p>
      </div>

      <IndicatorGroup heading="Prices and the policy rate">
        <IndicatorCard<PolicyRateValues>
          title="SBP policy rate"
          indicator={indicators.policyRate}
          wide
          note="SBP's series records changes only, so a Monetary Policy Committee meeting that leaves the rate unchanged does not move this date."
        >
          {(v) => (
            <Figures
              rows={[
                { label: "Policy (target) rate", value: <Percent value={v.ratePercent} /> },
                { label: "Date of last policy rate change", value: formatDay(v.lastChangeDate) },
              ]}
            />
          )}
        </IndicatorCard>

        <IndicatorCard<CpiValues>
          title="Inflation (CPI)"
          indicator={indicators.cpi}
          wide
          note="Core inflation is SBP's non-food non-energy (NFNE) measure, which EasyData publishes separately for urban and rural consumers."
        >
          {(v) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th scope="col" className="pb-2 font-medium">
                      <span className="sr-only">Measure</span>
                    </th>
                    {/* Abbreviated on phones, where the card is too narrow
                        for the full headings beside three labels. */}
                    <th scope="col" className="pb-2 pl-3 text-right font-medium">
                      <span className="hidden sm:inline">Year-on-year</span>
                      <abbr title="Year-on-year" className="no-underline sm:hidden">YoY</abbr>
                    </th>
                    <th scope="col" className="pb-2 pl-3 text-right font-medium">
                      <span className="hidden sm:inline">Month-on-month</span>
                      <abbr title="Month-on-month" className="no-underline sm:hidden">MoM</abbr>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { label: "Headline (national CPI)", pair: v.headline },
                    { label: "Core, urban (NFNE)", pair: v.core.urban },
                    { label: "Core, rural (NFNE)", pair: v.core.rural },
                  ].map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="py-2 text-left font-normal text-gray-400">
                        {row.label}
                      </th>
                      <td className="py-2 text-right font-semibold tabular-nums text-white">
                        <Percent value={row.pair.yoyPercent} />
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-white">
                        <Percent value={row.pair.momPercent} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </IndicatorCard>
      </IndicatorGroup>

      {/* Two readings, two period types — never merged into one "GDP growth". */}
      <IndicatorGroup heading="Growth">
        <IndicatorCard<GdpGrowthValues>
          title="Real GDP growth — annual"
          indicator={indicators.gdpAnnual}
          note="Pakistan Bureau of Statistics estimate, published through SBP EasyData."
        >
          {(v) => (
            <Figures rows={[{ label: "Growth rate", value: <Percent value={v.growthPercent} /> }]} />
          )}
        </IndicatorCard>

        <IndicatorCard<GdpGrowthValues>
          title="Real GDP growth — quarterly"
          indicator={indicators.gdpQuarterly}
          note="Pakistan Bureau of Statistics estimate, published through SBP EasyData."
        >
          {(v) => (
            <Figures rows={[{ label: "Growth rate", value: <Percent value={v.growthPercent} /> }]} />
          )}
        </IndicatorCard>
      </IndicatorGroup>

      <IndicatorGroup heading="External position">
        <IndicatorCard<FxReservesValues>
          title="Foreign exchange reserves"
          indicator={indicators.fxReserves}
          wide
        >
          {(v) => (
            <>
              <Figures
                rows={[
                  { label: "Net reserves held by SBP", value: <MillionUsd value={v.sbpNetMillionUsd} /> },
                  {
                    label: "Net reserves held by commercial banks",
                    value: <MillionUsd value={v.banksNetMillionUsd} />,
                  },
                ]}
              />
              {/*
               * The one figure on this page that SBP did not publish.
               * Set apart from the rows above — own box, own marker, and
               * the API's formula in full — so it can't be read as one of
               * them.
               */}
              <div className="mt-3 rounded-2xl border border-dashed border-blue-300/30 bg-blue-400/[0.05] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="flex items-center gap-2 text-sm text-gray-300">
                    Total liquid reserves
                    <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-blue-200">
                      Computed
                    </span>
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-blue-100">
                    <MillionUsd value={v.total.millionUsd} />
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">
                  <span className="font-semibold text-gray-300">
                    Calculated by AZEE, not published by SBP:
                  </span>{" "}
                  {v.total.formula}.
                </p>
              </div>
            </>
          )}
        </IndicatorCard>

        <IndicatorCard<TradeValues>
          title="Trade in goods"
          indicator={indicators.trade}
          note="As recorded in the balance of payments (BPM6), SBP's basis — which differs from customs trade data."
        >
          {(v) => (
            <Figures
              rows={[
                { label: "Exports", value: <MillionUsd value={v.exportsMillionUsd} /> },
                { label: "Imports", value: <MillionUsd value={v.importsMillionUsd} /> },
                {
                  label: v.balanceMillionUsd < 0 ? "Trade balance (deficit)" : "Trade balance (surplus)",
                  value: <MillionUsd value={v.balanceMillionUsd} />,
                },
              ]}
            />
          )}
        </IndicatorCard>

        <IndicatorCard<RemittancesValues>
          title="Workers' remittances"
          indicator={indicators.remittances}
          note="Money sent home by Pakistanis working abroad."
        >
          {(v) => <Figures rows={[{ label: "Inflow", value: <MillionUsd value={v.inflowMillionUsd} /> }]} />}
        </IndicatorCard>

        <IndicatorCard<ExternalDebtValues>
          title="External debt and liabilities"
          indicator={indicators.externalDebt}
          note="Outstanding at the end of the quarter."
        >
          {(v) => (
            <Figures
              rows={[{ label: "External debt and liabilities", value: <MillionUsd value={v.totalMillionUsd} /> }]}
            />
          )}
        </IndicatorCard>

        <IndicatorCard<DebtServicingValues>
          title="External debt servicing"
          indicator={indicators.debtServicing}
          note="SBP publishes these three figures without an overall one, and they don't combine into one cleanly — so they are shown separately and never added together."
        >
          {(v) => (
            <Figures
              rows={[
                { label: "Long-term principal payments", value: <MillionUsd value={v.longTermPrincipalMillionUsd} /> },
                { label: "Short-term principal payments", value: <MillionUsd value={v.shortTermPrincipalMillionUsd} /> },
                { label: "Interest payments", value: <MillionUsd value={v.interestMillionUsd} /> },
              ]}
            />
          )}
        </IndicatorCard>
      </IndicatorGroup>
    </>
  );
}

export function EconomicDashboardPage() {
  usePageMeta(
    "Pakistan Economic Dashboard | AZEE Trade",
    "Pakistan's key macroeconomic indicators from the State Bank of Pakistan's EasyData — the policy rate, inflation, GDP growth, foreign exchange reserves, trade, remittances and external debt, each with its own reporting period.",
  );

  const { data, loading, error } = useEconomicDashboard();

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Research
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            Pakistan Economic Dashboard
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            A single view of the macroeconomic indicators that move Pakistani
            markets — growth, prices, the policy rate, and the country&apos;s
            external position.
          </p>

          {error && !data ? (
            <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-16 text-center text-sm text-gray-400">
              Economic indicators are temporarily unavailable. Please try again
              shortly.
            </div>
          ) : loading && !data ? (
            <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-16 text-center text-sm text-gray-400">
              Loading economic indicators…
            </div>
          ) : data?.status === "pending" ? (
            <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
                Awaiting first update
              </p>
              <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
                {data.message}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
                No figures are shown until then, rather than numbers we have
                not collected.
              </p>
            </div>
          ) : data?.status === "ready" ? (
            <Indicators snapshot={data} />
          ) : null}

          <p className="mt-10 text-xs leading-relaxed text-gray-400/90">
            Every figure here is read from the State Bank of Pakistan&apos;s
            EasyData service and shown as SBP publishes it, in SBP&apos;s units,
            with the period it describes. GDP growth is compiled by the Pakistan
            Bureau of Statistics and published through EasyData. A figure
            calculated by AZEE rather than published by SBP is marked as
            computed, and an indicator we could not read is marked as such
            rather than filled in.
          </p>

          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            For live market prices, see{" "}
            <a href="/indices" className={LINK}>
              PSX indices
            </a>
            ,{" "}
            <a href="/market-watch" className={LINK}>
              market watch
            </a>{" "}
            and{" "}
            <a href="/forex" className={LINK}>
              exchange rates
            </a>{" "}
            — also live and sourced.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
