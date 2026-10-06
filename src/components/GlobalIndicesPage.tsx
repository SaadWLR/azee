import { PendingPage, type IntendedField } from "./PendingPage";

/*
 * /global-indices — structure only.
 *
 * NO INDEX LEVEL OR CHANGE FIGURE APPEARS HERE.
 *
 * Adjacent to, and deliberately not the same as, the Global Futures
 * tab on /commodities. That tab carries PMEX FUTURES CONTRACTS which
 * reference four benchmarks (S&P 500, Nasdaq-100, Dow Jones, Japan
 * Equity) — a contract price in a PMEX session, not the index. This
 * page is for the index levels themselves. The copy says so, so the
 * two are not read as duplicates of each other.
 */

const INTENDED: IntendedField[] = [
  {
    name: "Index",
    note: "The benchmark itself, under the name its exchange publishes",
  },
  {
    name: "Region",
    note: "Where the index trades, so sessions in different time zones are not read as simultaneous",
  },
  {
    name: "Level",
    note: "The index level, with the time it was last updated",
  },
  {
    name: "Change",
    note: "Move in index points from the previous close",
  },
  {
    name: "Change %",
    note: "The same move in percentage terms",
  },
];

export function GlobalIndicesPage() {
  return (
    <PendingPage
      eyebrow="Markets"
      title="Global Indices"
      metaTitle="Global Indices — World Market Benchmarks | AZEE Trade"
      metaDescription="Levels and daily moves for major world equity indices. Currently in preparation."
      maxWidth="max-w-5xl"
      lead={
        <>
          Major world equity benchmarks — the index level and how far it has
          moved today.
        </>
      }
      pending={
        <>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            This page is in preparation. No licensed source for international
            index levels is connected yet, so no level or change figure is shown
            here. Index data is generally licensed rather than open, and this
            page will wait for a source AZEE is entitled to publish.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            Every figure on this site is traced to a named source and carries
            that source&apos;s own date. Index levels will be held to the same
            standard before anything appears here.
          </p>
        </>
      }
      intended={INTENDED}
      columns={["Index", "Region", "Level", "Change", "Change %"]}
    >
      <p className="mt-7 text-sm font-semibold text-gray-300">
        Not the same as the Global Futures tab
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        AZEE&apos;s{" "}
        <a
          href="/commodities"
          className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
        >
          Commodity Futures page
        </a>{" "}
        already carries a Global Futures tab. Those are PMEX futures contracts
        that reference four international benchmarks, priced in a PMEX session —
        a contract, not the index. This page is for the index levels themselves,
        which is a different number from a different place.
      </p>
    </PendingPage>
  );
}
