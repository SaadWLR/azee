import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";

/*
 * /mutual-funds — structure only.
 *
 * Same discipline as the Economic Dashboard and the pending legal
 * pages: the route and its intended shape are real, the content is
 * honestly absent. NO FUND NAME, NAV OR RETURN FIGURE APPEARS HERE,
 * and none should be added ahead of the MUFAP sourcing milestone.
 *
 * This page exists specifically so that mutual funds stop being
 * implied as covered by the ETFs page. They are different products —
 * an ETF trades on the exchange intraday at a market price, an
 * open-end mutual fund is bought and sold at a NAV struck once daily
 * — and the site previously ran them together under one label.
 */

/** What the page is intended to carry. Intent, not data. */
const INTENDED: { name: string; note: string }[] = [
  {
    name: "Daily NAV",
    note: "Net asset value per unit for open-end schemes, with the date that NAV was actually struck",
  },
  {
    name: "Fund category",
    note: "Money market, income, equity, asset allocation, and their Shariah-compliant equivalents",
  },
  {
    name: "Asset management company",
    note: "The AMC operating each fund",
  },
  {
    name: "Offer and repurchase price",
    note: "The prices at which units are issued and redeemed",
  },
  {
    name: "Sales load",
    note: "Front-end, back-end and contingent charges, where they apply",
  },
  {
    name: "Risk profile",
    note: "The fund's stated risk categorisation",
  },
];

export function MutualFundsPage() {
  usePageMeta(
    "Mutual Funds | AZEE Trade",
    "Open-end mutual fund NAVs, categories and charges for Pakistani funds. Currently in preparation.",
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Markets
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            Mutual Funds
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Open-end mutual funds — daily net asset values, categories and
            charges for the schemes available to Pakistani investors.
          </p>

          <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
              Content pending
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              This page is in preparation. We have not yet confirmed a verified
              source for Pakistani mutual fund data, so no fund names, values or
              returns are shown — rather than publishing figures we cannot stand
              behind.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              Every figure on this site is traced to a named source and carries
              that source&apos;s own date. Fund data will be held to the same
              standard before anything appears here.
            </p>

            <p className="mt-7 text-sm font-semibold text-gray-300">
              What this page will show:
            </p>
            <dl className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
              {INTENDED.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6"
                >
                  <dt className="text-sm font-semibold text-gray-300 sm:w-52 sm:shrink-0">
                    {item.name}
                  </dt>
                  <dd className="text-sm text-gray-400">{item.note}</dd>
                </div>
              ))}
            </dl>

            {/*
             * The distinction this page exists to make. Worth stating on
             * the page itself, not just in the nav labels.
             */}
            <p className="mt-7 text-sm font-semibold text-gray-300">
              Mutual funds are not ETFs
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              An exchange traded fund trades on the Pakistan Stock Exchange
              throughout the session at a market price, like a share. An
              open-end mutual fund is bought and redeemed at a net asset value
              struck once each business day. AZEE&apos;s{" "}
              <a
                href="/etfs"
                className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
              >
                ETF page
              </a>{" "}
              carries live PSX-listed ETFs today and does not cover mutual
              funds.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
