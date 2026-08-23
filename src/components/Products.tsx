import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { Reveal } from "./Reveal";

/**
 * #products — the services AS a chain.
 *
 * WHY IT CHANGED AGAIN: the canvas list that replaced the old icon grid
 * fixed the "six identical SaaS tiles" problem but left the section
 * with nothing to look at — a headline, a paragraph and six long rows
 * of prose. Correct, and completely inert.
 *
 * THE IDEA IS THE HEADLINE'S. "Every market, one relationship." is a
 * claim about connection: the markets are separate, the relationship is
 * not. So the six services are drawn as six links of one chain, and the
 * chain is the composition — not an illustration placed beside the list,
 * but the thing the list is threaded onto. Hovering a service lights its
 * own link, so the mapping is mechanical rather than implied.
 *
 * IT IS A REAL CHAIN, NOT A MOTIF. The geometry is the geometry of an
 * actual chain and every part of it is load-bearing:
 *
 *   · Consecutive links alternate 90° about the chain's axis — one seen
 *     face-on, the next edge-on. That alternation is the single property
 *     that separates a chain from a stack of ovals, and it is why a
 *     chain can hang flat.
 *   · Links overlap by half a link-width, which puts each pair's end
 *     arcs one radius apart — the position they actually take when a
 *     chain hangs under its own weight.
 *   · They INTERLOCK, and the occlusion is worked out rather than
 *     assumed. Seen head-on, a turned link is the nearer body at BOTH
 *     of its joints — it threads through the hole above it and the
 *     hole below it, and its near run occludes both arcs — so every
 *     edge-on link must read in front at both ends and every face-on
 *     link behind at both. Document order alone gives each link
 *     precedence over the one above it only, which is right at half
 *     the joints and inverted at the other half; the inverted ones are
 *     corrected by redrawing the turned link clipped to that joint.
 *   · The wire is shaded across its width — light on one side, dark on
 *     the other — because it is round bar stock lit from the left. That
 *     is a material on a real form, not an ambient wash.
 *
 * THE ANIMATION IS THE ASSEMBLY. On first scroll into view the links
 * descend one after another from above and lock into their neighbour,
 * top to bottom, with each service's row arriving on the same beat. The
 * chain builds itself; it does not fade in. It runs once, and
 * prefers-reduced-motion skips straight to the assembled state.
 *
 * NOTHING WAS INVENTED. All six real services remain and every
 * description is a trim of the copy that was already here — clauses
 * removed to fix the wordiness, none added. The two with real
 * destinations (/commodities, /mutual-funds) still route there, and the
 * four without a page behind them stay inert and now carry no arrow
 * either, since an arrow on a row that goes nowhere is a promise the
 * section cannot keep.
 *
 * MOBILE IS ITS OWN COMPOSITION: a narrower chain in a tighter gutter,
 * with the name and description stacked beside it instead of set
 * opposite each other across the row.
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
    text: "PSX ready and futures markets, margin on eligible symbols.",
  },
  {
    title: "PMEX Commodities",
    text: "Gold, silver, crude oil and currency futures, exchange-cleared.",
    to: "/commodities",
  },
  {
    title: "IPO Investment",
    text: "Primary-market subscriptions, book-building and listing-day analysis.",
  },
  {
    title: "Mutual Funds",
    text: "Open-end equity, income and money-market funds.",
    to: "/mutual-funds",
  },
  {
    title: "Market Research",
    text: "Daily notes, sector studies and company reports.",
  },
  {
    title: "Portfolio Advisory",
    text: "Structured guidance aligned to your objectives and risk appetite.",
  },
];

/**
 * A chain's dimensions, in CSS pixels.
 *
 * `pitch` is the distance between link centres and MUST equal the row
 * height at the same breakpoint — that is what puts each link beside
 * its own service rather than near it. The row heights below are
 * written as literal pixels for that reason, and the e2e spec asserts
 * the two still agree rather than trusting this comment.
 */
interface ChainGeometry {
  pitch: number;
  /** Outer width of a link seen face-on. */
  width: number;
  /** Apparent width of the same link turned 90° to the viewer. */
  edgeWidth: number;
  /** Wire thickness. */
  wire: number;
}

const DESKTOP: ChainGeometry = {
  pitch: 120,
  width: 58,
  edgeWidth: 18,
  wire: 2.5,
};
const MOBILE: ChainGeometry = {
  pitch: 128,
  width: 40,
  edgeWidth: 13,
  wire: 2,
};

/** Row heights, matching the pitches above. */
const ROW_HEIGHT = "h-[128px] lg:h-[120px]";
/** Gutter the chain occupies, plus breathing room before the text. */
const ROW_INDENT = "pl-[62px] lg:pl-[96px]";

/** Milliseconds between one link locking in and the next. */
const LINK_STAGGER = 110;

function chainMetrics(geo: ChainGeometry, count: number) {
  // Half a link-width of overlap puts each pair's end arcs exactly one
  // radius apart — a hanging chain's resting geometry.
  const overlap = geo.width / 2;
  const length = geo.pitch + overlap;
  const gutter = geo.width + geo.wire * 2;
  return {
    overlap,
    length,
    gutter,
    height: (count - 1) * geo.pitch + length,
    cx: gutter / 2,
  };
}

/**
 * The chain itself. Decorative — the services are real content in the
 * list beside it — so it is hidden from assistive technology.
 */
function Chain({
  count,
  geo,
  linked,
  lit,
  className,
}: {
  count: number;
  geo: ChainGeometry;
  /** Has the section been scrolled into view yet? */
  linked: boolean;
  /** Index of the service currently hovered or focused, if any. */
  lit: number | null;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { overlap, length, gutter, height, cx } = chainMetrics(geo, count);

  const links = Array.from({ length: count }, (_, i) => i);
  const joints = Array.from({ length: count - 1 }, (_, j) => j);

  const linkShape = (i: number) => {
    // Even links face the viewer; odd links are turned 90° and read as
    // a narrow bar. This alternation is what makes it a chain.
    const faceOn = i % 2 === 0;
    const w = faceOn ? geo.width : geo.edgeWidth;
    const active = lit === i;
    const ramp = `${uid}-${active ? "lit" : "metal"}-${faceOn ? "face" : "edge"}`;
    return (
      <rect
        x={cx - w / 2}
        y={i * geo.pitch + geo.wire / 2}
        width={w}
        height={length - geo.wire}
        rx={w / 2}
        ry={w / 2}
        fill="none"
        stroke={`url(#${ramp})`}
        strokeWidth={active ? geo.wire + 0.6 : geo.wire}
        style={{ transition: "stroke-width 0.3s ease" }}
      />
    );
  };

  // The entrance: each link falls into its neighbour, one after the
  // next. Shared between a link and its woven copy so the two halves of
  // the same link never separate mid-flight.
  const linkMotion = (i: number): CSSProperties => ({
    opacity: linked ? 1 : 0,
    transform: linked ? "translateY(0)" : `translateY(-${overlap + 8}px)`,
    transition: "opacity 0.5s ease-out, transform 0.75s cubic-bezier(0.16,1,0.3,1)",
    transitionDelay: `${i * LINK_STAGGER}ms`,
  });

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={gutter}
      height={height}
      viewBox={`0 0 ${gutter} ${height}`}
      className={`chain ${className ?? ""}`}
    >
      <defs>
        {/*
         * ROUND BAR STOCK, LIT FROM THE LEFT.
         *
         * The gradient runs in USER SPACE across the link's own width,
         * not in the default bounding-box space. That distinction is
         * the whole treatment: a bounding-box gradient is sampled over
         * the link's full 58px, so each vertical run of wire — which is
         * only ~2px wide and sits at the very edge of that box — picks
         * up a single value from the extreme end of the ramp, and the
         * shading lands on the end ARCS instead of down the sides. The
         * result reads as a stripe across the ovals rather than as
         * light falling on a bar.
         *
         * Spanning the link's actual x-range instead puts the bright
         * value on the left run, the dark value on the right, and lets
         * the arcs sweep between them — which is what a lit round bar
         * does. The faint lift at the far edge is the rim light metal
         * always picks up off its surroundings.
         *
         * Face-on and edge-on links need their own ramps because they
         * are different widths and each has to be lit across its own
         * section, not across the gutter.
         */}
        {[
          { key: "face", w: geo.width },
          { key: "edge", w: geo.edgeWidth },
        ].map(({ key, w }) => (
          <Fragment key={key}>
            <linearGradient
              id={`${uid}-metal-${key}`}
              gradientUnits="userSpaceOnUse"
              x1={cx - w / 2}
              y1={0}
              x2={cx + w / 2}
              y2={0}
            >
              <stop offset="0%" stopColor="rgb(var(--azee-chalk))" stopOpacity="0.9" />
              <stop offset="34%" stopColor="rgb(var(--azee-chalk))" stopOpacity="0.4" />
              <stop offset="68%" stopColor="rgb(var(--azee-chalk))" stopOpacity="0.16" />
              <stop offset="100%" stopColor="rgb(var(--azee-chalk))" stopOpacity="0.38" />
            </linearGradient>
            <linearGradient
              id={`${uid}-lit-${key}`}
              gradientUnits="userSpaceOnUse"
              x1={cx - w / 2}
              y1={0}
              x2={cx + w / 2}
              y2={0}
            >
              <stop offset="0%" stopColor="rgb(var(--azee-orange))" stopOpacity="1" />
              <stop offset="34%" stopColor="rgb(var(--azee-orange))" stopOpacity="0.85" />
              <stop offset="68%" stopColor="rgb(var(--azee-orange))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(var(--azee-orange))" stopOpacity="0.8" />
            </linearGradient>
          </Fragment>
        ))}

        {/*
         * One band per joint, covering just the region where two links
         * overlap. Redrawing the upper link inside its band puts it
         * back in front of the lower one — see the weave below.
         */}
        {joints
          .filter((j) => j % 2 === 1)
          .map((j) => (
            <clipPath key={j} id={`${uid}-joint${j}`}>
              <rect
                x={0}
                y={(j + 1) * geo.pitch}
                width={gutter}
                height={overlap}
              />
            </clipPath>
          ))}
      </defs>

      {/*
       * Document order gives each link precedence over the one ABOVE
       * it. At joint j that puts link j+1 in front — right at the even
       * joints, where j+1 is the turned link, and inverted at the odd
       * ones, where j+1 is face-on.
       */}
      {links.map((i) => (
        <g key={i} style={linkMotion(i)}>
          {linkShape(i)}
        </g>
      ))}

      {/*
       * The correction. At each odd joint the turned link is the one
       * ABOVE, so it is drawn a second time, clipped to that joint
       * alone, to put it back in front. After this every turned link
       * reads in front at both its ends and every face-on link behind
       * at both — the occlusion an interlocked chain actually produces
       * head-on, rather than the uniform stack of overlapping ovals
       * document order would leave.
       *
       * The clip sits on the OUTER group so the band stays fixed in
       * the chain's own coordinates while the link moves inside it
       * during the entrance; on the inner group it would travel with
       * the link and expose the seam mid-flight.
       */}
      {joints
        .filter((j) => j % 2 === 1)
        .map((j) => (
          <g key={`weave-${j}`} clipPath={`url(#${uid}-joint${j})`}>
            <g style={linkMotion(j)}>{linkShape(j)}</g>
          </g>
        ))}
    </svg>
  );
}

export function Products() {
  const listRef = useRef<HTMLUListElement>(null);
  const [linked, setLinked] = useState(false);
  const [lit, setLit] = useState<number | null>(null);

  /*
   * The chain assembles the first time the list reaches the viewport,
   * then stays assembled. Same trigger contract as Reveal — one shot,
   * observer disconnected — so the section never re-animates on the
   * way back up.
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setLinked(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLinked(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mobile = chainMetrics(MOBILE, PRODUCTS.length);
  const desktop = chainMetrics(DESKTOP, PRODUCTS.length);

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

        <div className="relative mt-20">
          {/*
           * Two chains, one shown per breakpoint. A single chain scaled
           * between them would either thin its wire to nothing on a
           * phone or bloat it on a desktop; the wire is the one
           * dimension that has to stay constant to read as metal.
           *
           * Each is pulled up by half an overlap so its link centres
           * land on the row centres exactly.
           */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 lg:hidden"
            style={{ top: -mobile.overlap / 2 }}
          >
            <Chain count={PRODUCTS.length} geo={MOBILE} linked={linked} lit={lit} />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 hidden lg:block"
            style={{ top: -desktop.overlap / 2 }}
          >
            <Chain count={PRODUCTS.length} geo={DESKTOP} linked={linked} lit={lit} />
          </div>

          <ul ref={listRef} className="relative">
            {PRODUCTS.map((product, i) => {
              const body = (
                <>
                  <span className="font-display text-[1.6rem] text-[rgb(var(--azee-chalk))] transition-colors duration-300 group-hover:text-[rgb(var(--azee-orange))] sm:text-[1.9rem]">
                    {product.title}
                  </span>
                  <span className="mt-2 max-w-md text-sm leading-relaxed text-white/40 lg:mt-0 lg:max-w-[19rem] lg:shrink-0 lg:text-right">
                    {product.text}
                  </span>
                  {/* Only the services with a page behind them get an
                      arrow; the rest make no promise. */}
                  {product.to ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-white/25 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[rgb(var(--azee-orange))] lg:static lg:translate-y-0 lg:shrink-0"
                    >
                      →
                    </span>
                  ) : null}
                </>
              );

              const rowClass = `group flex h-full flex-col justify-center pr-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:pr-0 ${ROW_INDENT}`;

              return (
                <li
                  key={product.title}
                  data-product-row="true"
                  className={`relative ${ROW_HEIGHT}`}
                  style={{
                    // Arrives on the same beat as its own link.
                    opacity: linked ? 1 : 0,
                    transform: linked ? "translateX(0)" : "translateX(10px)",
                    transition:
                      "opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16,1,0.3,1)",
                    transitionDelay: `${i * LINK_STAGGER + 120}ms`,
                  }}
                  onMouseEnter={() => setLit(i)}
                  onMouseLeave={() => setLit(null)}
                >
                  {product.to ? (
                    <Link
                      to={product.to}
                      className={rowClass}
                      onFocus={() => setLit(i)}
                      onBlur={() => setLit(null)}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
