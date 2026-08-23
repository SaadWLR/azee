import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";

/*
 * /economic-dashboard — structure only.
 *
 * Same discipline as the Knowledge Centre modules and the pending
 * legal pages: the route and its intended shape are real, the content
 * is honestly absent. NOT ONE INDICATOR VALUE APPEARS HERE, and none
 * should be added until each has a verified source — this project has
 * already rejected several plausible-looking macro and rate sources
 * for fabricating freshness, and a dashboard is exactly the surface
 * where an unsourced number would be taken as fact.
 *
 * The indicator list below is a statement of intent, not data.
 */

/**
 * The indicators this dashboard is intended to carry. Chosen as the
 * set a Pakistani investor actually watches — growth, prices, the
 * policy rate, and the external position — rather than an exhaustive
 * macro dump. Each still needs its own sourcing decision.
 */
const INTENDED_INDICATORS: { name: string; note: string }[] = [
  {
    name: "GDP growth",
    note: "Annual and quarterly real growth, as published by the Pakistan Bureau of Statistics",
  },
  {
    name: "Inflation (CPI)",
    note: "Headline and core CPI, year-on-year and month-on-month",
  },
  {
    name: "SBP policy rate",
    note: "The State Bank's policy rate and the date of the last Monetary Policy Committee decision",
  },
  {
    name: "Foreign exchange reserves",
    note: "SBP reserves, commercial bank reserves and the total",
  },
  {
    name: "External debt",
    note: "Total external debt and liabilities, and debt servicing",
  },
  {
    name: "Trade balance",
    note: "Exports, imports and the resulting deficit or surplus",
  },
  {
    name: "Workers' remittances",
    note: "Monthly inflows, a major support for the rupee",
  },
];

export function EconomicDashboardPage() {
  usePageMeta(
    "Pakistan Economic Dashboard | AZEE Trade",
    "Key Pakistani macroeconomic indicators — GDP growth, inflation, the SBP policy rate, foreign exchange reserves and the external position. Currently in preparation.",
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Research
          </p>
          <h1 className="font-display mt-3 text-[2.5rem] text-[rgb(var(--azee-chalk))] sm:text-5xl">
            Pakistan Economic Dashboard
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            A single view of the macroeconomic indicators that move Pakistani
            markets — growth, prices, the policy rate, and the country&apos;s
            external position.
          </p>

          <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
              Content pending
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              This dashboard is in preparation. We have not yet identified and
              verified a source for each indicator, so no figures are shown —
              rather than publishing numbers we cannot stand behind.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              Every figure on this site is traced to a named source and carries
              that source&apos;s own timestamp. Macroeconomic data will be held
              to the same standard before anything appears here.
            </p>

            <p className="mt-7 text-sm font-semibold text-gray-300">
              Indicators planned for this dashboard:
            </p>
            <dl className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
              {INTENDED_INDICATORS.map((indicator) => (
                <div
                  key={indicator.name}
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6"
                >
                  <dt className="text-sm font-semibold text-gray-300 sm:w-56 sm:shrink-0">
                    {indicator.name}
                  </dt>
                  <dd className="text-sm text-gray-400">{indicator.note}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-7 text-sm leading-relaxed text-gray-400">
              In the meantime, the live market data already on this site —{" "}
              <a
                href="/indices"
                className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
              >
                PSX indices
              </a>
              ,{" "}
              <a
                href="/market-watch"
                className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
              >
                market watch
              </a>{" "}
              and{" "}
              <a
                href="/forex"
                className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
              >
                exchange rates
              </a>{" "}
              — is live and sourced.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
