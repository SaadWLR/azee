import { PendingPage, type IntendedField } from "./PendingPage";

/*
 * /ipo — structure only.
 *
 * NO COMPANY NAME, PRICE BAND, DATE OR ISSUE SIZE APPEARS HERE. An
 * invented IPO is worse than most invented data: a reader could act on
 * a subscription window that does not exist, and the window is the
 * whole point of the page.
 *
 * The open / upcoming / closed split is described in words rather than
 * built as tabs, because tabs that filter nothing are a lie about how
 * finished the page is.
 */

const INTENDED: IntendedField[] = [
  {
    name: "Company",
    note: "The issuer, and the exchange segment it is listing on",
  },
  {
    name: "Sector",
    note: "PSX's own sector classification for the issuer",
  },
  {
    name: "Price or band",
    note: "A fixed offer price, or the floor price and band for a book-building issue",
  },
  {
    name: "Subscription window",
    note: "The dates the offer opens and closes, which decide whether an investor can still act",
  },
  {
    name: "Issue size",
    note: "Shares on offer and the amount being raised",
  },
  {
    name: "Status",
    note: "Whether the offer is upcoming, open for subscription, or closed",
  },
];

export function IpoPage() {
  return (
    <PendingPage
      eyebrow="Markets"
      title="IPOs"
      metaTitle="IPOs — Pakistan Stock Exchange New Listings | AZEE Trade"
      metaDescription="Upcoming, open and closed initial public offerings on the Pakistan Stock Exchange. Currently in preparation."
      maxWidth="max-w-5xl"
      lead={
        <>
          Initial public offerings on the Pakistan Stock Exchange — what is open
          for subscription now, what is coming, and what has closed.
        </>
      }
      pending={
        <>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            This page is in preparation. No confirmed data source for PSX
            offering documents is connected yet, so no issuer, price band,
            subscription date or issue size is shown here — an invented
            subscription window is something a reader could act on and lose
            money over.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            Every figure on this site is traced to a named source and carries
            that source&apos;s own date. Offering data will be held to the same
            standard before anything appears here.
          </p>
        </>
      }
      intended={INTENDED}
      columns={[
        "Company",
        "Sector",
        "Price / band",
        "Subscription window",
        "Issue size",
        "Status",
      ]}
    >
      <p className="mt-7 text-sm font-semibold text-gray-300">
        How this page will be organised
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        Offers will be grouped as open, upcoming and closed, with open issues
        first, because the only group a reader can still act on is the open one.
        That grouping is described here rather than built as controls: a filter
        that filters nothing would misrepresent how far along this page is.
      </p>
    </PendingPage>
  );
}
