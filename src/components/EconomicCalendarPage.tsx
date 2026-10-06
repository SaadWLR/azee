import { PendingPage, type IntendedField } from "./PendingPage";

/*
 * /economic-calendar — structure only.
 *
 * NO DATE, RELEASE OR REFERENCE PERIOD APPEARS HERE. A release
 * calendar is a schedule, and a wrong schedule is worse than none: a
 * reader plans around it.
 *
 * DELIBERATELY NO FORECAST COLUMN, now or later. Consensus forecasts
 * are somebody else's estimate and would be the one number on this
 * page with no official source behind it. The page carries when a
 * figure is due and who publishes it; the figure itself lives on
 * /economic-dashboard.
 */

const INTENDED: IntendedField[] = [
  {
    name: "Date",
    note: "The scheduled release date, grouped so the next few days read first",
  },
  {
    name: "Release",
    note: "The statistic being published, e.g. monthly CPI or the balance of payments",
  },
  {
    name: "Source",
    note: "The institution publishing it — SBP, PBS or the Ministry of Finance",
  },
  {
    name: "Reference period",
    note: "The month, quarter or year the figure describes, which is rarely the month it is published in",
  },
];

export function EconomicCalendarPage() {
  return (
    <PendingPage
      eyebrow="Research & News"
      title="Economic Calendar"
      metaTitle="Economic Calendar — Pakistan Data Release Schedule | AZEE Trade"
      metaDescription="Scheduled release dates for Pakistani economic statistics from SBP, PBS and the Ministry of Finance. Currently in preparation."
      maxWidth="max-w-5xl"
      lead={
        <>
          When Pakistan&apos;s official economic statistics are published — the
          release date, the body publishing it, and the period each figure
          covers.
        </>
      }
      pending={
        <>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            This page is in preparation. No confirmed source for official
            release schedules is connected yet, so no date or release is listed
            — a calendar that is wrong about when a figure lands is worse than
            no calendar, because a reader plans around it.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            Every figure on this site is traced to a named source and carries
            that source&apos;s own date. Release dates will be held to the same
            standard before anything appears here.
          </p>
        </>
      }
      intended={INTENDED}
      columns={["Date", "Release", "Source", "Reference period"]}
    >
      <p className="mt-7 text-sm font-semibold text-gray-300">
        This page and the Economic Dashboard are different things
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        This calendar is about <em>when</em> a figure is due. The{" "}
        <a
          href="/economic-dashboard"
          className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
        >
          Economic Dashboard
        </a>{" "}
        carries the figures themselves — the current CPI, policy rate, reserves,
        trade and remittances readings, each with the period it describes and
        the date it was read. For any value published today, that page is the
        one to look at.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-gray-400">
        There will be no forecast or consensus column. An expected figure is an
        estimate by someone other than the issuing institution, and it would be
        the only number here without an official source standing behind it.
      </p>
    </PendingPage>
  );
}
