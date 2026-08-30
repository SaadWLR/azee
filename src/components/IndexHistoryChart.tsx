import { useId, useMemo, useState } from "react";
import type { EodPoint } from "../types/history";

/**
 * One PSX index's closing level over time.
 *
 * A SEPARATE COMPONENT FROM SentimentChart, not a reuse of it. That
 * chart plots a 0-100 composite against fixed zone bands — a reading
 * of 72 is "Extreme Optimism" wherever it appears, so the y-axis can
 * be painted once and every line read against it. An index level has
 * no such thing: 187,000 means nothing without knowing the index, and
 * the axis has to be derived from the series in front of it. Bolting a
 * dynamic axis and an optional band layer onto one component would
 * make both harder to read than two that each do one thing.
 *
 * The visual language IS shared, deliberately, so the two read as one
 * system: same viewBox and padding, same four range tabs, same
 * truncation note, same date formatting, same chalk-on-navy.
 *
 * SHORTER SERIES ARE DRAWN SHORT. Three of the ten benchmark indices
 * have less history than the rest because they launched later —
 * PSXDIV20 from Sep 2022, BKTI and OGTI from Oct 2021, against Aug
 * 2021 for the other seven. A range tab reaching past the start of the
 * archive draws what exists and says so, exactly as SentimentChart
 * does. Padding the left edge to fill the tab would be inventing
 * prices.
 */

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/* Plot area, in viewBox units — same geometry as SentimentChart. */
const W = 720;
const H = 260;
const PAD = { top: 12, right: 56, bottom: 26, left: 8 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Axis labels for an index level, which runs from a few hundred to a
 * few hundred thousand across these ten. Thousands are compacted so
 * the gutter does not have to hold "187,454.64"; the range header
 * carries the exact figures.
 */
const fmtLevel = (value: number) =>
  value >= 10_000
    ? `${Math.round(value / 1000).toLocaleString("en-US")}k`
    : value.toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtExact = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function IndexHistoryChart({ points }: { points: EodPoint[] }) {
  const [range, setRange] = useState<RangeKey>("1Y");
  // The gradient lives in <defs> and is referenced by id; two charts on
  // one page would otherwise share — and fight over — one id.
  const gradientId = useId();

  const view = useMemo(() => {
    if (!points.length) return null;
    const days = RANGES.find((r) => r.key === range)!.days;
    const latest = new Date(`${points[points.length - 1].date}T00:00:00Z`);
    const cutoff = new Date(latest);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    // Whatever of the requested window actually exists — never padded
    // to look complete.
    const shown = points.filter((p) => p.date >= cutoffIso);
    if (shown.length < 2) return null;

    const closes = shown.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    /*
     * A flat stretch would otherwise divide by zero and collapse the
     * line onto one edge. Giving it a nominal band draws it as the
     * straight line it is, centred.
     */
    const span = max - min || Math.max(1, max * 0.01);
    const pad = span * 0.08;
    const lo = min - pad;
    const hi = max + pad;

    const xFor = (i: number) =>
      PAD.left + (PLOT_W * i) / Math.max(1, shown.length - 1);
    const yFor = (close: number) =>
      PAD.top + PLOT_H * (1 - (close - lo) / (hi - lo));

    const first = shown[0];
    const last = shown[shown.length - 1];
    const changePct = ((last.close - first.close) / first.close) * 100;

    return {
      shown,
      xFor,
      yFor,
      first,
      last,
      min,
      max,
      changePct,
      /** Four evenly-spaced levels across the drawn band. */
      ticks: [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3),
      /** True when the window asked for more than the archive holds. */
      truncated: points[0].date > cutoffIso,
    };
  }, [points, range]);

  const up = (view?.changePct ?? 0) >= 0;
  const stroke = up ? "rgb(52 199 123)" : "rgb(233 81 38)";

  return (
    <div className="px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-300/80">
            Closing level
          </p>
          {view ? (
            <p className="mt-1.5 text-xs text-gray-400">
              {fmtDate(view.first.date)} — {fmtDate(view.last.date)}
              <span
                className="ml-3 font-semibold tabular-nums"
                style={{ color: stroke }}
              >
                {up ? "+" : ""}
                {view.changePct.toFixed(2)}%
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
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors duration-300 ${
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
       * Said rather than hidden — the same rule the sentiment chart
       * follows. A 1Y tab drawing ten months is only misleading if
       * nothing accounts for the difference.
       */}
      {view?.truncated ? (
        <p className="mt-2.5 text-[11px] text-white/45">
          This index's archive starts {fmtDate(points[0].date)} — the range
          shows every session available, not a full {range}.
        </p>
      ) : null}

      {view ? (
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[520px]"
            role="img"
            aria-label={`Closing level from ${fmtDate(view.first.date)} to ${fmtDate(view.last.date)}, ${fmtExact(view.first.close)} to ${fmtExact(view.last.close)}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal rules at the labelled levels. */}
            {view.ticks.map((tick) => (
              <line
                key={tick}
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={view.yFor(tick)}
                y2={view.yFor(tick)}
                stroke="rgb(255 255 255 / 0.07)"
                strokeWidth={1}
              />
            ))}

            {/* Right-hand scale, derived from this series' own range. */}
            {view.ticks.map((tick) => (
              <text
                key={`label-${tick}`}
                x={PAD.left + PLOT_W + 8}
                y={view.yFor(tick)}
                dominantBaseline="middle"
                className="fill-white/40 text-[10px] tabular-nums"
              >
                {fmtLevel(tick)}
              </text>
            ))}

            {/* Fill under the line, then the line itself. */}
            <path
              d={
                `M ${view.xFor(0)} ${PAD.top + PLOT_H}` +
                view.shown
                  .map((p, i) => ` L ${view.xFor(i)} ${view.yFor(p.close)}`)
                  .join("") +
                ` L ${view.xFor(view.shown.length - 1)} ${PAD.top + PLOT_H} Z`
              }
              fill={`url(#${gradientId})`}
            />
            <path
              d={view.shown
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${view.xFor(i)} ${view.yFor(p.close)}`,
                )
                .join(" ")}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* The latest close, marked. */}
            <circle
              cx={view.xFor(view.shown.length - 1)}
              cy={view.yFor(view.last.close)}
              r={4}
              fill={stroke}
              stroke="rgb(var(--azee-navy))"
              strokeWidth={2}
            />

            <text x={PAD.left} y={H - 6} className="fill-white/40 text-[10px]">
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

          <p className="mt-2 text-[11px] text-gray-400/90">
            Close {fmtExact(view.last.close)} · range {fmtExact(view.min)} —{" "}
            {fmtExact(view.max)} over this window. End-of-day closing levels
            from the Pakistan Stock Exchange, published once per trading day.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray-400">
          Not enough history in this range to draw a chart.
        </p>
      )}
    </div>
  );
}
