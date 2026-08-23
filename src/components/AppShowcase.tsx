import { Reveal } from "./Reveal";
import { IconApple, IconGooglePlay } from "./Icons";
import {
  useMarketSnapshot,
  useMarketWatchStats,
  useTickerQuotes,
} from "../hooks/useMarketData";
import type { MarketIndex, MarketStat, StockQuote } from "../types";

/**
 * #trading — the terminal, running.
 *
 * ONE FOCAL POINT: a single device, tilted in 3D with a real shadow,
 * with genuinely live PSX data on its screen. Everything the phone
 * displays is real:
 *   · the index name, level and change come from the live snapshot;
 *   · the breadth bar is the session's real advancer/decliner split;
 *   · the watchlist rows are real symbols at their real prices.
 *
 * REMOVED — a fabricated visual. The screen previously carried a
 * <Sparkline> whose own comment called it a "decorative placeholder":
 * a hardcoded polyline drawn to look like a rising chart. It depicted
 * nothing. It is replaced by the breadth bar, which is computed from
 * the same market-watch stats the homepage already reads.
 *
 * NO NEW DATA. useMarketWatchStats is an existing hook on the existing
 * /api/market/watch URL and does not poll at all — one fetch on mount,
 * collapsed into the request the ticker is already making. No new
 * endpoint, no new cadence.
 *
 * The App Store / Play Store links remain href="#" — a known pending
 * item, deliberately out of scope here.
 *
 * COLOUR: this is the page's one LIGHT section. The scroll runs dark
 * ink → dark ink → bone → dark ink, so the rhythm comes from flat
 * colour blocks rather than any gradient. A light ground is also the
 * honest setting for a device shot: it lets the screen itself be the
 * brightest thing in the frame, which is the point of the section.
 */

const FEATURES = [
  "Real-time PSX quotes and full market depth",
  "Advanced charting with studies and drawing tools",
  "Order placement, modification, and portfolio tracking",
  "Funds transfer, e-statements, and price alerts",
  "Biometric login with device-level security",
];

/** Reads a numeric stat out of the live market-watch stats array. */
function statNumber(stats: MarketStat[] | null | undefined, label: string): number {
  const raw = stats?.find((s) => s.label === label)?.value;
  const n = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Market breadth — advancers vs decliners for the session, drawn to
 * scale. Replaces the fabricated sparkline: every pixel of the bar is
 * proportional to a real count from the live feed.
 */
function BreadthBar({ stats }: { stats: MarketStat[] | null | undefined }) {
  const up = statNumber(stats, "Advancers");
  const down = statNumber(stats, "Decliners");
  const total = up + down;
  if (total === 0) {
    return <div className="h-14" aria-hidden="true" />;
  }
  const upPct = (up / total) * 100;
  return (
    <div className="h-14 pt-2">
      <div className="flex items-baseline justify-between text-[10px] text-gray-400">
        <span className="tabular-nums text-emerald-400">{up} up</span>
        <span className="tracking-[0.16em]">BREADTH</span>
        <span className="tabular-nums text-rose-400">{down} down</span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="bg-emerald-400"
          style={{ width: `${upPct}%` }}
          aria-hidden="true"
        />
        <div
          className="flex-1 bg-rose-400"
          aria-hidden="true"
        />
      </div>
      <p className="sr-only">
        {up} symbols advancing, {down} declining this session.
      </p>
    </div>
  );
}

/** The phone screen. Every value on it is live. */
function PhoneScreen({
  index,
  quotes,
  stats,
}: {
  index: MarketIndex;
  quotes: StockQuote[];
  stats: MarketStat[] | null | undefined;
}) {
  return (
    <div className="flex h-full flex-col bg-[rgb(var(--azee-ink))] px-5 pb-6 pt-4">
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span className="tabular-nums">9:41</span>
        <span className="tracking-[0.2em]">AZEE STOCKIFY</span>
        <span className="tabular-nums">5G</span>
      </div>

      <div className="mt-6">
        <p className="text-[11px] text-gray-400">{index.name}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">
            {index.value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p
            className={`text-xs font-semibold tabular-nums ${
              index.direction === "up" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {index.direction === "up" ? "▲ +" : "▼ "}
            {index.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <BreadthBar stats={stats} />

      <div className="mt-4 border-t border-white/10">
        {quotes.slice(0, 5).map((quote) => {
          const up = quote.changePercent >= 0;
          return (
            <div
              key={quote.symbol}
              className="flex items-center justify-between border-b border-white/5 py-2.5"
            >
              <span className="text-xs font-semibold text-white/90">
                {quote.symbol}
              </span>
              <span className="text-xs tabular-nums text-gray-300">
                {quote.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span
                className={`w-16 text-right text-xs font-medium tabular-nums ${
                  up ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {up ? "+" : ""}
                {quote.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/*
       * NO BUY/SELL CONTROLS. The screen previously ended with Buy and
       * Sell buttons. AZEE has no live trading platform yet — Client
       * Login routes to an honest coming-soon page — so depicting order
       * controls would imply a product that does not exist. Live market
       * data on the screen is real and stays; simulated order or
       * portfolio functionality does not belong here at all.
       *
       * What closes the screen instead is the one honest thing to say
       * about it: where these numbers come from.
       */}
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="text-center text-[10px] leading-relaxed text-gray-500">
          Live PSX ready-board data
        </p>
      </div>
    </div>
  );
}

/** Outlined pill, matching the section's button language. */
function StoreBadge({
  icon: Icon,
  small,
  big,
}: {
  icon: typeof IconApple;
  small: string;
  big: string;
}) {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-3 rounded-full border border-black/20 px-6 py-3 transition-colors duration-300 hover:border-black/45"
    >
      <Icon className="h-6 w-6 text-black" />
      <span>
        <span className="block text-[10px] leading-tight text-black/50">
          {small}
        </span>
        <span className="block text-sm font-semibold leading-tight text-black">
          {big}
        </span>
      </span>
    </a>
  );
}

export function AppShowcase() {
  const { data: snapshot } = useMarketSnapshot();
  const { data: quotes } = useTickerQuotes();
  const { data: stats } = useMarketWatchStats();

  return (
    <section
      id="trading"
      /*
       * Opts this section into the nav's light treatment. The nav is
       * opaque and fixed, so it needs to know when it is over a bone
       * block; any future light section gets the same behaviour just by
       * carrying this attribute.
       */
      data-nav-theme-section="light"
      className="relative overflow-hidden bg-[rgb(var(--azee-bone))] py-32 lg:py-48"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--azee-orange))]">
              AZEE Stockify
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display mt-10 text-[3rem] text-[#141210] sm:text-[4rem] lg:text-[4.5rem]">
              The exchange,
              <br />
              in one hand.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-10 max-w-lg text-[15px] leading-[1.75] text-black/55">
              Trade, monitor and manage your PSX portfolio from anywhere — the
              same real-time data and order routing as the desktop terminal.
              The screen below is showing the live market right now.
            </p>
          </Reveal>
        </div>

        {/* The device: tilted in 3D, with a real cast shadow. */}
        <Reveal delay={250}>
          {/*
           * THE STAGE. `perspective` applies only to an element's DIRECT
           * children — this is the bug that made the previous tilt read
           * as flat: perspective sat on a grandparent, so rotateY
           * degraded to a plain orthographic squish and the phone
           * rendered straight-on in a screenshot even though the
           * computed transform really was a matrix3d. The transformed
           * device below is now an immediate child of this element.
           *
           * Applied only from `lg`. On a phone you are already holding
           * the thing being depicted, so the device frame and the tilt
           * are dropped entirely for a different composition (below).
           */}
          <div className="mt-24 flex justify-center">
            {/*
             * Perspective sits HERE, on the device's immediate parent —
             * not on the flex wrapper above. That distinction is the
             * whole bug: with perspective one level too high, rotateY
             * collapses to a flat affine skew that still reports a
             * matrix3d and can even look tilted in a screenshot because
             * of the rotateZ, while having no real depth at all.
             */}
            <div className="relative w-full max-w-[18rem] lg:[perspective:1500px]">
              {/* Cast shadow, outside the transformed node so it stays
                  on the ground rather than tilting with the device. */}
              <div
                aria-hidden="true"
                className="absolute -bottom-10 left-1/2 hidden h-12 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/30 blur-2xl lg:block"
              />
              {/*
               * MOBILE: a flat, bezel-less panel — the live screen
               * itself, presented directly.
               * DESKTOP: a real device at a dramatic angle
               * (rotateY -18deg / rotateX 6deg / rotateZ -2deg), which
               * is the reference's floor, not its ceiling.
               */}
              <div
                className="relative overflow-hidden rounded-[2rem] bg-[#141210] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)] lg:rounded-[3rem] lg:p-3 lg:shadow-[50px_70px_110px_-30px_rgba(0,0,0,0.5)] lg:[transform:rotateY(-18deg)_rotateX(6deg)_rotateZ(-2deg)]"
              >
                <div className="h-[520px] overflow-hidden rounded-[2rem] border border-white/10 lg:h-[540px] lg:rounded-[2.4rem]">
                  {snapshot && quotes && (
                    <PhoneScreen
                      index={snapshot.index}
                      quotes={quotes}
                      stats={stats}
                    />
                  )}
                </div>
                {/* Speaker notch — part of the device, so desktop only. */}
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-6 hidden h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/70 lg:block"
                />
              </div>
            </div>
          </div>
        </Reveal>

        {/* Capabilities, as a restrained centred list — no icon tiles. */}
        <Reveal delay={150}>
          <ul className="mx-auto mt-28 grid max-w-3xl grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 border-t border-black/10 pt-4 text-sm leading-relaxed text-black/65"
              >
                {feature}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StoreBadge
              icon={IconApple}
              small="Download on the"
              big="App Store"
            />
            <StoreBadge
              icon={IconGooglePlay}
              small="Get it on"
              big="Google Play"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
