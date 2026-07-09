import { useEffect, useState } from "react";
import { FadeIn } from "./FadeIn";
import {
  KSE_100,
  MARKET_STATS,
  MARKET_TIMESTAMP,
  RECENT_RESEARCH,
  type Direction,
} from "../data/marketData";

/** Eases a number from 0 to `target` once, for the index counter. */
function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}

function DirectionArrow({ direction }: { direction: Direction }) {
  return direction === "up" ? (
    <span className="text-emerald-400">▲</span>
  ) : (
    <span className="text-red-400">▼</span>
  );
}

export function MarketSnapshot() {
  const indexValue = useCountUp(KSE_100.value, 1400, 1500);

  return (
    <FadeIn delay={1500}>
      <div className="liquid-glass-strong glass-sheen w-full rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(0,0,0,0.5)] xl:w-[24rem]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
            PSX Market Snapshot
          </p>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-300">
              LIVE
            </span>
          </span>
        </div>

        {/* KSE-100 */}
        <div className="mt-5">
          <p className="text-xs font-medium text-gray-300">{KSE_100.name}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">
              {indexValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-sm font-semibold text-emerald-400 tabular-nums">
              ▲ +{KSE_100.changePercent.toFixed(2)}%
            </p>
          </div>
          <p className="mt-0.5 text-xs text-gray-300 tabular-nums">
            +{KSE_100.changePoints.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}{" "}
            pts
          </p>
        </div>

        {/* Session stats */}
        <div className="mt-5 border-t border-white/15">
          {MARKET_STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between border-b border-white/10 py-2.5 last:border-b-0"
            >
              <p className="text-xs text-gray-300">{stat.label}</p>
              <p className="flex items-center gap-1.5 text-sm font-medium text-white tabular-nums">
                {stat.direction && <DirectionArrow direction={stat.direction} />}
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Research */}
        <div className="mt-4 border-t border-white/15 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
            Recent Research
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {RECENT_RESEARCH.map((title) => (
              <li key={title}>
                <a
                  href="#"
                  className="group flex items-center justify-between text-sm text-white/90 transition-colors duration-300 hover:text-white"
                >
                  <span>• {title}</span>
                  <span className="text-gray-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-[10px] tracking-wide text-gray-300/70">
          Data: Pakistan Stock Exchange · {MARKET_TIMESTAMP}
        </p>
      </div>
    </FadeIn>
  );
}
