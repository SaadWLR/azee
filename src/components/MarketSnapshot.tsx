import { useEffect, useState } from "react";
import { FadeIn } from "./FadeIn";
import { useMarketSnapshot } from "../hooks/useMarketData";
import { useRecentResearchTitles } from "../hooks/useResearch";
import type { Direction } from "../types";

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

/**
 * Simulated live drift — a placeholder for a real market-data feed.
 * Every few seconds the index nudges a few points and the value
 * flashes green or red. Replace with socket updates without touching
 * the render below.
 */
function useLiveDrift(intervalMs = 5000) {
  const [delta, setDelta] = useState(0);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const step = (Math.random() - 0.45) * 24;
      setDelta((d) => d + step);
      setFlash(step >= 0 ? "up" : "down");
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(timeout);
  }, [flash]);

  return { delta, flash };
}

function DirectionArrow({ direction }: { direction: Direction }) {
  return direction === "up" ? (
    <span className="text-emerald-400">▲</span>
  ) : (
    <span className="text-rose-400">▼</span>
  );
}

export function MarketSnapshot() {
  const { data: snapshot } = useMarketSnapshot();
  const { data: recentResearch } = useRecentResearchTitles();
  const indexValue = useCountUp(snapshot?.index.value ?? 0, 1400, 1500);
  const { delta, flash } = useLiveDrift();

  if (!snapshot) return null;

  const open = snapshot.status === "OPEN";

  return (
    <FadeIn delay={1500}>
      <div className="liquid-glass-strong glass-sheen card-glow w-full rounded-3xl p-7 xl:w-[24rem]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            PSX Market Snapshot
          </p>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {open && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  open ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
            </span>
            <span
              className={`text-[10px] font-bold tracking-[0.2em] ${
                open ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {open ? "LIVE" : "CLOSED"}
            </span>
          </span>
        </div>

        {/* KSE-100 */}
        <div className="mt-6">
          <p className="text-xs font-medium text-gray-400">
            {snapshot.index.name}
          </p>
          <div className="mt-1.5 flex items-baseline gap-3">
            <p
              key={flash ? `${flash}-${delta}` : "steady"}
              className={`text-[2rem] font-semibold leading-none tracking-tight text-white tabular-nums ${
                flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""
              }`}
            >
              {(indexValue + delta).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                snapshot.index.direction === "up"
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {snapshot.index.direction === "up" ? "▲ +" : "▼ "}
              {snapshot.index.changePercent.toFixed(2)}%
            </p>
          </div>
          <p className="mt-1.5 text-xs text-gray-400 tabular-nums">
            {snapshot.index.direction === "up" ? "+" : ""}
            {snapshot.index.changePoints.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}{" "}
            pts
          </p>
        </div>

        {/* Session stats */}
        <div className="mt-6 border-t border-blue-200/15">
          {snapshot.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between border-b border-blue-200/10 py-2.5 last:border-b-0"
            >
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="flex items-center gap-1.5 text-sm font-medium text-white tabular-nums">
                {stat.direction && <DirectionArrow direction={stat.direction} />}
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Research */}
        <div className="mt-5 border-t border-blue-200/15 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Recent Research
          </p>
          <ul className="mt-3 space-y-1.5">
            {(recentResearch ?? []).map((title) => (
              <li key={title}>
                <a
                  href="#research"
                  className="group flex items-center justify-between text-sm text-white/90 transition-colors duration-500 hover:text-white"
                >
                  <span>• {title}</span>
                  <span className="text-gray-400 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-[10px] tracking-wide text-gray-400/80">
          Data: Pakistan Stock Exchange · {snapshot.timestamp}
        </p>
      </div>
    </FadeIn>
  );
}
