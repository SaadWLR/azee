import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { IconApple, IconGooglePlay } from "./Icons";
import { useMarketSnapshot, useTickerQuotes } from "../hooks/useMarketData";
import type { MarketIndex, StockQuote } from "../types";

const FEATURES = [
  "Real-time PSX quotes and full market depth",
  "Advanced charting with studies and drawing tools",
  "Order placement, modification, and portfolio tracking",
  "Funds transfer, e-statements, and price alerts",
  "Biometric login with device-level security",
];

/** Sparkline for the mock app screen — decorative placeholder. */
function Sparkline() {
  return (
    <svg
      viewBox="0 0 200 56"
      className="h-14 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points="0,44 18,40 36,42 54,32 72,35 90,24 108,28 126,18 144,22 162,12 180,16 200,6"
        fill="none"
        stroke="rgb(52 211 153)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A crafted placeholder screen — replace with real app captures by
 * dropping an <img> into the phone frame.
 */
function PhoneScreen({
  index,
  quotes,
}: {
  index: MarketIndex;
  quotes: StockQuote[];
}) {
  return (
    <div className="flex h-full flex-col bg-black/85 px-5 pb-6 pt-4">
      {/* Status bar */}
      <div className="flex items-center justify-between text-[10px] text-gray-300">
        <span className="tabular-nums">9:41</span>
        <span className="tracking-[0.2em]">AZEE STOCKIFY</span>
        <span className="tabular-nums">5G</span>
      </div>

      {/* Index header */}
      <div className="mt-6">
        <p className="text-[11px] text-gray-300">{index.name}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {index.value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs font-semibold text-emerald-400 tabular-nums">
            ▲ +{index.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Sparkline />
      </div>

      {/* Watchlist */}
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
              <span className="text-xs text-gray-300 tabular-nums">
                {quote.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span
                className={`w-16 text-right text-xs font-medium tabular-nums ${
                  up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {up ? "+" : ""}
                {quote.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Buy / Sell */}
      <div className="mt-auto flex gap-3 pt-4">
        <span className="flex-1 rounded-full bg-white py-2.5 text-center text-xs font-bold text-black">
          Buy
        </span>
        <span className="liquid-glass flex-1 rounded-full py-2.5 text-center text-xs font-bold text-white">
          Sell
        </span>
      </div>
    </div>
  );
}

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
      className="liquid-glass flex items-center gap-3 rounded-2xl px-5 py-3 transition-all duration-500 hover:scale-[1.04] hover:bg-white/20 hover:shadow-[0_0_28px_rgb(var(--azee-blue)/0.22)] active:scale-[0.98]"
    >
      <Icon className="h-7 w-7 text-white" />
      <span>
        <span className="block text-[10px] leading-tight text-gray-400">
          {small}
        </span>
        <span className="block text-sm font-semibold leading-tight text-white">
          {big}
        </span>
      </span>
    </a>
  );
}

export function AppShowcase() {
  const { data: snapshot } = useMarketSnapshot();
  const { data: quotes } = useTickerQuotes();

  return (
    <section id="trading" className="relative overflow-hidden py-24 lg:py-32">
      {/* Soft spotlight behind the phone */}
      <div aria-hidden="true" className="bg-spotlight absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="AZEE Stockify"
              title="The Pakistan Stock Exchange, in your pocket."
              description="Trade, monitor, and manage your PSX portfolio from anywhere — the same real-time data and order routing as the desktop terminal, rebuilt for one hand."
            />

            <Reveal delay={150}>
              <ul className="mt-8 space-y-3">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm leading-relaxed text-gray-400 sm:text-base"
                  >
                    <span className="mt-1 text-emerald-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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

          <Reveal delay={200}>
            <div className="phone-float relative mx-auto w-64 sm:w-72">
              {/* Glow beneath the device */}
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full bg-white/5 blur-3xl"
              />
              <div className="liquid-glass-strong relative rounded-[3rem] p-3 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
                <div className="h-[540px] overflow-hidden rounded-[2.4rem] border border-white/10">
                  {snapshot && quotes && (
                    <PhoneScreen index={snapshot.index} quotes={quotes} />
                  )}
                </div>
                {/* Speaker notch */}
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-6 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/70"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
