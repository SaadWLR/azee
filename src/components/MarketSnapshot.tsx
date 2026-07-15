import { useEffect, useRef, useState } from "react";
import { FadeIn } from "./FadeIn";
import { IconExternalLink } from "./Icons";
import {
  useMarketSnapshot,
  useMarketWatchStats,
} from "../hooks/useMarketData";
import { useLatestNews } from "../hooks/useNews";
import type { Direction, MarketStat } from "../types";

/**
 * Which live market-watch stats the panel shows, in display order.
 * Volume plus breadth reads like a terminal side panel without
 * cluttering the card; Symbols Traded adds little for investors.
 */
const SESSION_STAT_LABELS = ["Market Volume", "Advancers", "Decliners"];

/**
 * Eases the displayed number toward `target`. First mount animates
 * from 0 with the entrance delay (the original behavior); subsequent
 * target changes — e.g. a background poll delivering a fresh index
 * level — glide from the CURRENTLY displayed value with no delay, so
 * a refetch never flashes the value back to zero.
 */
function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0);
  const displayedRef = useRef(0);
  const firstRunRef = useRef(true);

  useEffect(() => {
    const from = displayedRef.current;
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;
    let raf = 0;
    const start = performance.now() + (isFirstRun ? delay : 0);
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      displayedRef.current = next;
      setValue(next);
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
    <span className="text-rose-400">▼</span>
  );
}

export function MarketSnapshot() {
  const { data: snapshot } = useMarketSnapshot();
  const { data: watchStats } = useMarketWatchStats();
  const { data: news } = useLatestNews();
  const sessionStats = SESSION_STAT_LABELS.map((label) =>
    watchStats?.find((stat) => stat.label === label),
  ).filter((stat): stat is MarketStat => stat !== undefined);
  const latestHeadlines = news?.items.slice(0, 3) ?? [];
  const indexValue = useCountUp(snapshot?.index.value ?? 0, 1400, 1500);

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
            <p className="text-[2rem] font-semibold leading-none tracking-tight text-white tabular-nums">
              {indexValue.toLocaleString("en-US", {
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

        {/* Session stats — live market-watch data; the block renders
            only once real stats exist (no placeholder slots). */}
        {sessionStats.length > 0 && (
          <div className="mt-6 border-t border-blue-200/15">
            {sessionStats.map((stat) => (
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
        )}

        {/* Latest news — live, attributed headlines linking out to the
            publisher; the block renders only once headlines load. */}
        {latestHeadlines.length > 0 && (
          <div className="mt-5 border-t border-blue-200/15 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Latest News
            </p>
            <ul className="mt-3 space-y-2">
              {latestHeadlines.map((item) => (
                <li key={item.title}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-2 text-sm text-white/90 transition-colors duration-500 hover:text-white"
                  >
                    <span className="line-clamp-2">{item.title}</span>
                    <IconExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-[10px] tracking-wide text-gray-400/80">
          Data: Pakistan Stock Exchange · {snapshot.timestamp}
        </p>
      </div>
    </FadeIn>
  );
}
