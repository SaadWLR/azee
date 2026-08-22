import { Link } from "react-router-dom";
import { Reveal } from "./Reveal";

/**
 * #products — a canvas list, not a card grid.
 *
 * WHY IT CHANGED: six identical navy glass tiles, each with an icon in
 * a rounded box and a number in the corner, is the default SaaS
 * component — and once the sections around it became ink and bone, the
 * navy grid read as a leftover from a different site. Cards should feel
 * special; six of them in a row makes them feel like the fallback.
 *
 * WHAT REPLACED IT: the services sit directly on the section ground,
 * separated by hairline rules and typographic weight alone. No boxes,
 * no icons, no shadows. Hover is the only interaction and it does one
 * thing — the name takes the accent and the row's arrow advances.
 *
 * NOTHING WAS DROPPED. All six real services remain, with their real
 * descriptions, and the two with real destinations (/commodities,
 * /mutual-funds) still route there. The four without a page behind them
 * stay inert rather than pretending — same convention as the Footer's
 * LIVE_ROUTES.
 *
 * MOBILE IS ITS OWN COMPOSITION: the desktop row is a single line with
 * the name left and the description right-aligned opposite it, which
 * needs width to read. On a phone that becomes a stacked block — name,
 * then description beneath it — because two columns squeezed into
 * 375px is how this pattern usually fails.
 */

interface Product {
  title: string;
  text: string;
  /** In-app destination, for the services that have a real page. */
  to?: string;
}

const PRODUCTS: Product[] = [
  {
    title: "Equity Trading",
    text: "PSX-listed shares in the ready and futures markets, with real-time quotes and margin on eligible symbols.",
  },
  {
    title: "PMEX Commodities",
    text: "Gold, silver, crude oil and currency futures on the Pakistan Mercantile Exchange, exchange-cleared.",
    to: "/commodities",
  },
  {
    title: "IPO Investment",
    text: "Primary-market subscriptions, with book-building coverage and listing-day analysis.",
  },
  {
    title: "Mutual Funds",
    text: "Open-end funds across equity, income and money-market categories.",
    to: "/mutual-funds",
  },
  {
    title: "Market Research",
    text: "Daily notes, sector studies and company reports — fundamental and technical.",
  },
  {
    title: "Portfolio Advisory",
    text: "Structured guidance aligned to your objectives and risk appetite.",
  },
];

function Row({ product }: { product: Product }) {
  const rowClass =
    "group block border-t border-white/10 py-8 lg:flex lg:items-baseline lg:justify-between lg:gap-16 lg:py-10";

  /*
   * Desktop reads as one line: name, description opposite it, arrow at
   * the end. Mobile stacks name+arrow, then the description beneath.
   * The arrow is rendered in whichever position that breakpoint needs
   * and hidden in the other, so neither layout inherits the other's
   * compromises.
   */
  const body = (
    <>
      <div className="flex flex-1 items-baseline justify-between gap-6 lg:gap-10">
        <span className="font-display text-[1.75rem] text-[rgb(var(--azee-chalk))] transition-colors duration-300 group-hover:text-[rgb(var(--azee-orange))] sm:text-[2rem]">
          {product.title}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-white/25 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[rgb(var(--azee-orange))] lg:hidden"
        >
          →
        </span>
      </div>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/40 lg:mt-0 lg:max-w-xs lg:shrink-0 lg:text-right">
        {product.text}
      </p>
      <span
        aria-hidden="true"
        className="hidden shrink-0 text-white/25 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[rgb(var(--azee-orange))] lg:block"
      >
        →
      </span>
    </>
  );



  return product.to ? (
    <Link to={product.to} className={rowClass}>
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}

export function Products() {
  return (
    <section
      id="products"
      className="relative bg-[rgb(var(--azee-ink))] py-32 lg:py-48"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-white/10"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12">
        <div className="max-w-2xl">
          {/* Level 5 — metadata */}
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--azee-orange))]">
              Products &amp; Services
            </p>
          </Reveal>
          {/* Level 1 — hero statement */}
          <Reveal delay={100}>
            <h2 className="font-display mt-10 text-[3rem] text-[rgb(var(--azee-chalk))] sm:text-[4rem]">
              Every market,
              <br />
              one relationship.
            </h2>
          </Reveal>
          {/* Level 3 — supporting line */}
          <Reveal delay={200}>
            <p className="mt-10 max-w-md text-[15px] leading-[1.75] text-white/50">
              Equities, commodities, primary-market offerings and managed
              products — executed and researched under one regulated roof.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 border-b border-white/10">
          {PRODUCTS.map((product, i) => (
            <Reveal key={product.title} delay={Math.min(i, 3) * 80}>
              <Row product={product} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
