import { PendingPage, type IntendedField } from "./PendingPage";

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
 *
 * It renders through PendingPage, which was extracted FROM this page:
 * the markup it emits is the markup this file used to carry inline,
 * so the rendered result is unchanged. It carries no `columns` table,
 * exactly as before.
 */

/** What the page is intended to carry. Intent, not data. */
const INTENDED: IntendedField[] = [
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
  return (
    <PendingPage
      eyebrow="Markets"
      title="Mutual Funds"
      metaTitle="Mutual Funds | AZEE Trade"
      metaDescription="Open-end mutual fund NAVs, categories and charges for Pakistani funds. Currently in preparation."
      lead={
        <>
          Open-end mutual funds — daily net asset values, categories and charges
          for the schemes available to Pakistani investors.
        </>
      }
      pending={
        <>
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
        </>
      }
      intended={INTENDED}
    >
      {/*
       * The distinction this page exists to make. Worth stating on
       * the page itself, not just in the nav labels.
       */}
      <p className="mt-7 text-sm font-semibold text-gray-300">
        Mutual funds are not ETFs
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        An exchange traded fund trades on the Pakistan Stock Exchange throughout
        the session at a market price, like a share. An open-end mutual fund is
        bought and redeemed at a net asset value struck once each business day.
        AZEE&apos;s{" "}
        <a
          href="/etfs"
          className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
        >
          ETF page
        </a>{" "}
        carries live PSX-listed ETFs today and does not cover mutual funds.
      </p>
    </PendingPage>
  );
}
