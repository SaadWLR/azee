import { useMemo, useState } from "react";
import { ZONE_BANDS, zoneStyle } from "../lib/sentimentZones";
import type { HistoricalScore } from "../services/sentimentService";

/**
 * Sentiment over time.
 *
 * WHAT THE SERIES IS. Every point is the composite recomputed for that
 * date by the same code that computes today's, ranked against the 500
 * sessions that preceded THAT day rather than against today's window.
 * It is a reconstruction from PSX's own archive, and it is honest
 * because no point uses information the market did not have on the
 * day.
 *
 * IT IS ALSO SHORTER THAN IT LOOKS LIKE IT SHOULD BE, and that is left
 * visible. Each signal needs ~90 sessions of lookback plus 500 to rank
 * against, so the series begins about 590 sessions into the archive
 * rather than at its start. A range tab whose window reaches past that
 * simply draws the part that exists and says so in the date label —
 * the alternative would be padding the left of the chart with points
 * nobody computed, which is the one thing a chart must never do.
 */

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/* Plot area, in viewBox units. */
const W = 720;
const H = 260;
const PAD = { top: 12, right: 44, bottom: 26, left: 8 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Score (0-100) → y. The axis runs fear at the bottom, optimism up. */
const yFor = (score: number) => PAD.top + PLOT_H * (1 - score / 100);

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function SentimentChart({ series }: { series: HistoricalScore[] }) {
  const [range, setRange] = useState<RangeKey>("3M");

  const view = useMemo(() => {
    if (!series.length) return null;
    const days = RANGES.find((r) => r.key === range)!.days;
    const latest = new Date(`${series[series.length - 1].date}T00:00:00Z`);
    const cutoff = new Date(latest);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    // Whatever of the requested window actually exists. If the series
    // starts inside the window, this is simply shorter than a full
    // range — never padded to look complete.
    const points = series.filter((p) => p.date >= cutoffIso);
    if (points.length < 2) return null;

    const xFor = (i: number) =>
      PAD.left + (PLOT_W * i) / Math.max(1, points.length - 1);

    return {
      points,
      xFor,
      first: points[0],
      last: points[points.length - 1],
      change: points[points.length - 1].score - points[0].score,
      /** True when the window asked for more than the series holds. */
      truncated: series[0].date > cutoffIso,
    };
  }, [series, range]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[1.75rem] text-[rgb(var(--azee-chalk))] sm:text-[2rem]">
            Sentiment over time
          </h2>
          {view ? (
            <p className="mt-2 text-sm text-white/55">
              {fmtDate(view.first.date)} — {fmtDate(view.last.date)}
              <span
                className="ml-3 font-semibold tabular-nums"
                style={{ color: zoneStyle(view.last.zone).text }}
              >
                {view.change >= 0 ? "+" : ""}
                {view.change} pts
              </span>
            </p>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Chart range"
          className="inline-flex items-center gap-1 rounded-full border border-white/12 p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                range === r.key
                  ? "bg-[rgb(var(--azee-chalk))] text-[rgb(var(--azee-navy))]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {/*
       * The window reaching past the start of the series is stated
       * rather than hidden. A 1Y tab drawing eight months of line is
       * only misleading if nothing says so.
       */}
      {view?.truncated ? (
        <p className="mt-3 text-xs text-white/45">
          The reconstruction starts {fmtDate(series[0].date)} — this range shows
          every session available, not a full {range}.
        </p>
      ) : null}

      {view ? (
        <div className="mt-6 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[520px]"
            role="img"
            aria-label={`Fear and Optimism Index from ${fmtDate(view.first.date)} to ${fmtDate(view.last.date)}`}
          >
            {/* Zone bands behind the line, so a reading's height is
                immediately a zone rather than a number to look up. */}
            {ZONE_BANDS.map((band) => (
              <rect
                key={band.zone}
                x={PAD.left}
                y={yFor(band.to)}
                width={PLOT_W}
                height={yFor(band.from) - yFor(band.to)}
                fill={band.wash}
              />
            ))}
            {ZONE_BANDS.slice(1).map((band) => (
              <line
                key={`rule-${band.zone}`}
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={yFor(band.from)}
                y2={yFor(band.from)}
                stroke="rgb(255 255 255 / 0.07)"
                strokeWidth={1}
              />
            ))}

            {/* Right-hand scale. */}
            {[0, 25, 50, 75, 100].map((tick) => (
              <text
                key={tick}
                x={PAD.left + PLOT_W + 8}
                y={yFor(tick)}
                dominantBaseline="middle"
                className="fill-white/40 text-[10px] tabular-nums"
              >
                {tick}
              </text>
            ))}

            {/*
             * The line, drawn one segment at a time and coloured by the
             * zone each segment ends in. A single-colour line would
             * make the reader match heights against the bands by eye;
             * this way the line says which zone it is in.
             */}
            {view.points.slice(1).map((point, idx) => {
              const prev = view.points[idx];
              return (
                <line
                  key={point.date}
                  x1={view.xFor(idx)}
                  y1={yFor(prev.score)}
                  x2={view.xFor(idx + 1)}
                  y2={yFor(point.score)}
                  stroke={zoneStyle(point.zone).stroke}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}

            {/* The latest reading, marked. */}
            <circle
              cx={view.xFor(view.points.length - 1)}
              cy={yFor(view.last.score)}
              r={4}
              fill={zoneStyle(view.last.zone).stroke}
              stroke="rgb(var(--azee-navy))"
              strokeWidth={2}
            />

            <text
              x={PAD.left}
              y={H - 6}
              className="fill-white/40 text-[10px]"
            >
              {fmtDate(view.first.date)}
            </text>
            <text
              x={PAD.left + PLOT_W}
              y={H - 6}
              textAnchor="end"
              className="fill-white/40 text-[10px]"
            >
              {fmtDate(view.last.date)}
            </text>
          </svg>
        </div>
      ) : (
        <p className="mt-6 text-sm text-white/55">
          Not enough reconstructed history yet to draw this range.
        </p>
      )}
    </div>
  );
}
