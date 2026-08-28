import { ZONE_BANDS } from "../lib/sentimentZones";
import type { SentimentZone } from "../types/sentiment";

/**
 * The Fear and Optimism dial, in two sizes.
 *
 * ONE COMPONENT FOR BOTH PLACES. The homepage teaser and the full page
 * show the same instrument at different levels of detail, and drawing
 * it twice is how the needle ends up at 55 on one and 56 on the other.
 * The geometry, the wedges and the needle are computed here once; the
 * variant only decides how much labelling comes with them.
 *
 * THE GEOMETRY IS REAL. Wedge boundaries, tick positions, zone-name
 * positions and the needle all come from the same polar helper applied
 * to the same published thresholds, so the picture cannot disagree
 * with the arithmetic behind it — a wedge ends where a zone ends
 * because both are the same number.
 */

interface Geometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  /** Centreline radius of the wedge ring. */
  r: number;
  /** Thickness of the wedge ring. */
  band: number;
  /** How far short of the ring the needle stops. */
  needleInset: number;
}

/**
 * Small enough to sit in a hero panel without dominating it.
 *
 * The height leaves room BELOW the hub for the two end labels. At 132
 * — exactly the label baseline — every glyph was clipped by the edge
 * of the viewBox, which is invisible in a computed-style check and
 * obvious in a screenshot.
 */
const COMPACT: Geometry = {
  width: 240,
  height: 142,
  cx: 120,
  cy: 116,
  r: 92,
  band: 11,
  needleInset: 16,
};

/**
 * Larger, and with room OUTSIDE the ring for zone names.
 *
 * The extra width is not decoration. "EXTREME OPTIMISM" is ~78px of
 * horizontal text hung off a point near the arc's shoulder, and the
 * arc curves back under it — centred on that point, half the label sat
 * ON the wedge. It is anchored away from the dial instead (see below),
 * which needs the margin on both sides to grow into.
 */
const DETAILED: Geometry = {
  width: 450,
  height: 214,
  cx: 225,
  cy: 176,
  r: 130,
  band: 19,
  needleInset: 32,
};

/** Score → angle in degrees, measured the usual way from +x. */
const angleFor = (score: number) => 180 - 1.8 * score;

function pointAt(geo: Geometry, score: number, radius: number) {
  const rad = (angleFor(score) * Math.PI) / 180;
  return {
    x: geo.cx + radius * Math.cos(rad),
    y: geo.cy - radius * Math.sin(rad),
  };
}

function arcPath(geo: Geometry, from: number, to: number, radius: number) {
  const a = pointAt(geo, from, radius);
  const b = pointAt(geo, to, radius);
  // Every wedge is well under a half turn, so large-arc is always 0;
  // rising score runs clockwise on screen, so sweep is always 1.
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const TICKS = [0, 25, 50, 75, 100];

export function SentimentDial({
  score,
  zone,
  variant = "compact",
  className,
}: {
  score?: number;
  zone?: SentimentZone;
  variant?: "compact" | "detailed";
  className?: string;
}) {
  const geo = variant === "detailed" ? DETAILED : COMPACT;
  const detailed = variant === "detailed";
  const needle =
    score === undefined ? undefined : pointAt(geo, score, geo.r - geo.needleInset);

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className={`w-full ${className ?? ""}`}
      role="img"
      aria-label={
        score === undefined
          ? "Fear and Optimism Index — no live signal yet"
          : `Fear and Optimism Index: ${score} out of 100, ${zone}`
      }
    >
      {/*
       * The five wedges. Each is inset by a fraction of a score point
       * at both ends so the ring reads as five separate segments
       * rather than one continuous arc that happens to change colour.
       */}
      {ZONE_BANDS.map((band) => (
        <path
          key={band.zone}
          d={arcPath(geo, band.from + 0.6, band.to - 0.6, geo.r)}
          fill="none"
          stroke={band.stroke}
          strokeWidth={geo.band}
          strokeLinecap="butt"
        />
      ))}

      {detailed && (
        <>
          {/* Zone names, set OUTSIDE the ring where there is room. */}
          {ZONE_BANDS.map((band) => {
            const mid = (band.from + band.to) / 2;
            const at = pointAt(geo, mid, geo.r + 16);
            /*
             * Anchored AWAY from the dial. A label centred on its
             * band's midpoint grows in both directions, and because
             * the arc curves back beneath the shoulders, the inner
             * half of a long name ends up drawn over the wedge. Text
             * on the left half therefore ends at its anchor and runs
             * outward, text on the right starts there — so a name can
             * only ever grow into empty space.
             */
            const anchor =
              mid < 45 ? "end" : mid > 55 ? "start" : "middle";
            return (
              <text
                key={`name-${band.zone}`}
                x={at.x.toFixed(2)}
                y={at.y.toFixed(2)}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={band.text}
                className="text-[8px] font-bold uppercase"
                style={{ letterSpacing: "0.04em" }}
              >
                {band.zone}
              </text>
            );
          })}

          {/* The numeric scale, inside the ring. */}
          {TICKS.map((tick) => {
            const at = pointAt(geo, tick, geo.r - geo.band - 8);
            return (
              <text
                key={`tick-${tick}`}
                x={at.x.toFixed(2)}
                y={at.y.toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white/45 text-[8px] font-medium tabular-nums"
              >
                {tick}
              </text>
            );
          })}
        </>
      )}

      {/*
       * The needle, drawn only when there is a score to point at. An
       * idle dial shows its wedges and no needle rather than parking
       * one at the middle, which would read as a Neutral measurement
       * rather than an absent one.
       */}
      {needle ? (
        <>
          <line
            x1={geo.cx}
            y1={geo.cy}
            x2={needle.x.toFixed(2)}
            y2={needle.y.toFixed(2)}
            stroke="rgb(var(--azee-chalk))"
            strokeWidth={detailed ? 3 : 2.5}
            strokeLinecap="round"
          />
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={detailed ? 8 : 6}
            fill="rgb(var(--azee-chalk))"
          />
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={detailed ? 3.5 : 2.5}
            fill="rgb(var(--azee-navy))"
          />
        </>
      ) : (
        <circle
          cx={geo.cx}
          cy={geo.cy}
          r={detailed ? 8 : 6}
          fill="none"
          stroke="rgb(var(--azee-chalk) / 0.3)"
          strokeWidth={2}
        />
      )}

      {/* The compact dial has no room for zone names, so its two ends
          are labelled instead — enough to read which way it runs. */}
      {!detailed && (
        <>
          <text
            x={geo.cx - geo.r}
            y={geo.cy + 16}
            textAnchor="middle"
            className="fill-[rgb(var(--azee-blue))] text-[9px] font-semibold uppercase"
            style={{ letterSpacing: "0.08em" }}
          >
            Fear
          </text>
          <text
            x={geo.cx + geo.r}
            y={geo.cy + 16}
            textAnchor="middle"
            className="fill-[rgb(var(--azee-orange))] text-[9px] font-semibold uppercase"
            style={{ letterSpacing: "0.08em" }}
          >
            Optimism
          </text>
        </>
      )}
    </svg>
  );
}
