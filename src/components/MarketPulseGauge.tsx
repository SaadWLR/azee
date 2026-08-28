import { useFearOptimismIndex } from "../hooks/useMarketData";
import type { SentimentSignal, SentimentZone } from "../types/sentiment";

/**
 * The Fear and Optimism Index — a sentiment gauge built only from what
 * PSX actually gives us today.
 *
 * WHAT THIS SHOWS, AND WHAT IT REFUSES TO. The finished index needs
 * eight signals. Three of them — Momentum, Volatility and Volume
 * Momentum — are live, each a percentile rank of today's reading
 * against roughly two years of the same measure. The other five are
 * rendered PRESENT AND MARKED: named, described, and carrying a note
 * saying what would unlock them. None of them shows a number, and none
 * is hidden to make the list look finished. A gauge with three live
 * signals that looks like a gauge with eight is a lie about how much
 * the reading is worth.
 *
 * The needle therefore points at a composite of three signals today,
 * and the header says so rather than leaving the reader to assume the
 * eight-signal version.
 *
 * THE GEOMETRY IS REAL. Every band, tick and needle position is
 * computed from the same polar helper against the same published
 * bands, so the picture cannot drift from the arithmetic behind it —
 * the needle lands where the score says because both are the same
 * function of the same number. Same discipline as the chain in
 * Products.tsx: drawn from its own maths, not eyeballed into place.
 */

/* ── Gauge geometry, in viewBox units ──────────────────────────────
 *
 * A half-dial: score 0 at the left horizon, 100 at the right. The
 * centre sits low enough that the arc's own bounding box IS the
 * drawing, so there is no dead space under a semicircle.
 */
const CX = 120;
const CY = 116;
const R = 92;
/** How far short of the arc the needle stops. */
const NEEDLE_INSET = 16;

/** Score → angle, in degrees measured the usual way from +x. */
const angleFor = (score: number) => 180 - 1.8 * score;

/** Score → the point on a circle of radius `r` about the centre. */
function pointAt(score: number, r: number) {
  const rad = (angleFor(score) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

/**
 * The five bands, in the site's own palette.
 *
 * Cool to warm, using only tokens that already exist: --azee-blue for
 * the fear end, --azee-orange for the greed end, and a desaturated
 * chalk through the middle. Deliberately NOT a red/green scale —
 * red/green already means something specific everywhere else on this
 * site (a price up or down), and borrowing it here would read as a
 * gain and a loss rather than a mood.
 */
const BANDS: { from: number; to: number; zone: SentimentZone; stroke: string }[] =
  [
    { from: 0, to: 30, zone: "Extreme Fear", stroke: "rgb(var(--azee-blue) / 0.9)" },
    { from: 30, to: 45, zone: "Fear", stroke: "rgb(var(--azee-blue) / 0.45)" },
    { from: 45, to: 55, zone: "Neutral", stroke: "rgb(var(--azee-chalk) / 0.3)" },
    { from: 55, to: 70, zone: "Optimism", stroke: "rgb(var(--azee-orange) / 0.5)" },
    { from: 70, to: 100, zone: "Extreme Optimism", stroke: "rgb(var(--azee-orange))" },
  ];

/** Arc sweep between two scores, at radius `r`. */
function arcPath(from: number, to: number, r: number) {
  const a = pointAt(from, r);
  const b = pointAt(to, r);
  // Every band is well under a half turn, so large-arc is always 0;
  // rising score runs clockwise on screen, so sweep is always 1.
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function Dial({ score, zone }: { score?: number; zone?: SentimentZone }) {
  const needle = score === undefined ? undefined : pointAt(score, R - NEEDLE_INSET);

  return (
    <svg
      viewBox="0 0 240 132"
      className="w-full"
      role="img"
      aria-label={
        score === undefined
          ? "Fear and Optimism Index — no live signal yet"
          : `Fear and Optimism Index: ${score} out of 100, ${zone}`
      }
    >
      {/* The five zone bands. A gap between them comes from the
          stroke's own butt caps plus a 1-point inset at each join. */}
      {BANDS.map((band) => (
        <path
          key={band.zone}
          d={arcPath(band.from + 0.6, band.to - 0.6, R)}
          fill="none"
          stroke={band.stroke}
          strokeWidth={11}
          strokeLinecap="butt"
        />
      ))}

      {/*
       * The needle, drawn only when there is a score to point at. An
       * idle gauge shows the bands and no needle rather than parking
       * it at the middle, which would read as a Neutral measurement.
       */}
      {needle ? (
        <>
          <line
            x1={CX}
            y1={CY}
            x2={needle.x.toFixed(2)}
            y2={needle.y.toFixed(2)}
            stroke="rgb(var(--azee-chalk))"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={6} fill="rgb(var(--azee-chalk))" />
          <circle cx={CX} cy={CY} r={2.5} fill="rgb(var(--azee-navy))" />
        </>
      ) : (
        <circle
          cx={CX}
          cy={CY}
          r={6}
          fill="none"
          stroke="rgb(var(--azee-chalk) / 0.3)"
          strokeWidth={2}
        />
      )}

      {/* End labels, so the direction of the dial is unambiguous. */}
      <text
        x={CX - R}
        y={CY + 16}
        textAnchor="middle"
        className="fill-[rgb(var(--azee-blue))] text-[9px] font-semibold uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        Fear
      </text>
      <text
        x={CX + R}
        y={CY + 16}
        textAnchor="middle"
        className="fill-[rgb(var(--azee-orange))] text-[9px] font-semibold uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        Optimism
      </text>
    </svg>
  );
}

function SignalRow({ signal }: { signal: SentimentSignal }) {
  const live = signal.status === "live" && typeof signal.score === "number";
  return (
    <li className="border-t border-white/10 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-white/85">
          {signal.label}
        </span>
        {live ? (
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[rgb(var(--azee-orange))]">
            {signal.score}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Calibrating
          </span>
        )}
      </div>
      {/*
       * The note replaces the number rather than sitting beside it:
       * the reader's question about an inactive signal is "why", and
       * the answer is the only thing this row has to give.
       */}
      <p className="mt-0.5 text-[11px] leading-snug text-white/55">
        {live ? signal.description : signal.calibratingNote}
      </p>
    </li>
  );
}

export function MarketPulseGauge() {
  const { data, loading, error } = useFearOptimismIndex();

  const liveCount =
    data?.signals.filter((s) => s.status === "live").length ?? 0;

  return (
    <section
      aria-label="Fear and Optimism Index"
      className="rounded-3xl border border-white/12 bg-[rgb(var(--azee-navy)/0.55)] p-6 backdrop-blur-xl"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--azee-orange))]">
          Fear and Optimism Index
        </h2>
        {data?.zone ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
            {data.zone}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-[13px] leading-relaxed text-white/60">
          The Fear and Optimism Index is unavailable right now — the PSX
          feeds did not respond.
        </p>
      ) : (
        /*
         * Dial beside the signals wherever there is width for it. The
         * panel spans the hero's full measure, and a centred dial with
         * eight signals running underneath wastes that on whitespace
         * while making the section 600px tall. Side by side it reads
         * in one screen.
         */
        <div className="mt-5 lg:flex lg:items-start lg:gap-10">
          <div className="shrink-0 lg:w-[260px]">
            {/*
             * Capped rather than fluid: left to fill its container the
             * semicircle rendered ~700px wide and turned the hero into
             * a billboard for one number.
             */}
            <div className="mx-auto max-w-[240px]">
              <Dial score={data?.score} zone={data?.zone} />
            </div>

            <div className="mt-1 text-center">
            {data?.score !== undefined ? (
              <p className="font-display text-[2.5rem] leading-none text-[rgb(var(--azee-chalk))] tabular-nums">
                {data.score}
              </p>
            ) : (
              <p className="text-[13px] font-medium text-white/60">
                {loading ? "Reading the market…" : "No live signal yet"}
              </p>
            )}
            {/*
             * The denominator, stated rather than implied. A reader
             * who knows this index expects eight inputs; saying how
             * many are actually behind the needle is the difference
             * between a partial reading and a misleading one.
             */}
              <p className="mt-2 text-[11px] text-white/50">
                {liveCount} of {data?.signals.length ?? 8} signals live
                {data?.stale ? " · last known values" : ""}
              </p>
            </div>
          </div>

          {data ? (
            <ul className="mt-6 min-w-0 flex-1 sm:grid sm:grid-cols-2 sm:gap-x-8 lg:mt-0">
              {data.signals.map((signal) => (
                <SignalRow key={signal.key} signal={signal} />
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/45">
        The Fear and Optimism Index is an information tool, not investment
        advice — it
        describes market sentiment, not a recommendation to buy or sell.
      </p>
    </section>
  );
}
