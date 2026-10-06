import { PendingPage, type IntendedField } from "./PendingPage";

/*
 * /crypto — structure only.
 *
 * NO ASSET NAME, PRICE OR CHANGE FIGURE APPEARS HERE.
 *
 * NO VERDICT COPY OF ANY KIND, now or later: no signal, no rating, no
 * "bullish"/"bearish", no buy/sell framing. This page reports prices
 * when it reports anything.
 *
 * The copy here speaks ONLY about this page. It makes no statement
 * about what AZEE does or does not offer as a business — that is the
 * company's to describe, not this component's, and a page that is not
 * connected to a source yet is in no position to characterise it.
 */

const INTENDED: IntendedField[] = [
  {
    name: "Asset",
    note: "The coin or token, with the ticker its exchanges quote it under",
  },
  {
    name: "Price",
    note: "The last traded price, with the currency it is quoted in and the time it was read",
  },
  {
    name: "Change",
    note: "Move over the last 24 hours in price terms",
  },
  {
    name: "Change %",
    note: "The same move in percentage terms",
  },
];

export function CryptoPage() {
  return (
    <PendingPage
      eyebrow="Markets"
      title="Crypto"
      metaTitle="Crypto Prices | AZEE Trade"
      metaDescription="Reference prices and 24-hour moves for major digital assets. Currently in preparation."
      maxWidth="max-w-5xl"
      lead={
        <>
          Reference prices for major digital assets, and how far each has moved
          over the last 24 hours.
        </>
      }
      pending={
        <>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            This page is in preparation. No confirmed source for digital asset
            prices is connected yet, so no asset, price or change figure is
            shown here.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
            Every figure on this site is traced to a named source and carries
            that source&apos;s own date. Digital asset prices will be held to
            the same standard before anything appears here.
          </p>
        </>
      }
      intended={INTENDED}
      columns={["Asset", "Price", "Change", "Change %"]}
    >
      <p className="mt-7 text-sm font-semibold text-gray-300">
        What this page will and will not carry
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        Crypto currency prices are not available on this site yet. When they
        are, this page will report prices and the moves behind them, and nothing
        further — no rating, no signal, and no buy or sell framing on any asset
        listed here.
      </p>
    </PendingPage>
  );
}
