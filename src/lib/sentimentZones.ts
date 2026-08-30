import type { SentimentZone } from "../types/sentiment";

/**
 * The five zones, and how each one is drawn.
 *
 * ONE SOURCE FOR THE PALETTE. The dial's wedges, the legend chips, the
 * chart's background bands and line, and the signal cards' gradient
 * bars all colour the same five zones. Defining that mapping five
 * times is how a "Fear" band ends up one blue on the gauge and a
 * different blue on the chart, so it is defined once here.
 *
 * The thresholds live in sentimentService's ZONE_BANDS, which is what
 * actually decides a score's zone. These are the same numbers again
 * for LAYOUT — where a wedge starts and stops on the arc, where a band
 * sits on the chart's y-axis — and the pair is covered by a test that
 * asserts they agree, so the picture cannot drift from the arithmetic.
 *
 * COOL TO WARM, in the site's own palette. --azee-sky at the fear end,
 * --azee-orange at the optimism end, desaturated chalk between.
 * Deliberately not red/green: on this site red and green already mean
 * a price moved down or up, and borrowing them here would read as a
 * loss and a gain rather than a mood.
 *
 * SKY, NOT --azee-blue, and the distinction is the point. --azee-blue
 * is the site's ambient glow — it appears at 0.05-0.35 alpha behind
 * buttons and panel edges and is never asked to be a colour you look
 * AT. The fear zones use their colour at full strength on a wedge, a
 * chart line and a legend chip, and the deep royal read as a different
 * blue from the one every other page labels things with. This is that
 * lighter blue-300, the shade Indices, Market Watch and the calendar
 * already use for labels and badges, so the index looks like the rest
 * of the site rather than like a second palette.
 */
export interface ZoneBand {
  zone: SentimentZone;
  /** Score at which this band starts (inclusive). */
  from: number;
  /** Score at which the next band starts (exclusive). */
  to: number;
  /** Arc wedge / chart band fill. */
  stroke: string;
  /** Text colour when the zone is named. */
  text: string;
  /** Very low-alpha wash, for chart backgrounds and card tints. */
  wash: string;
}

export const ZONE_BANDS: ZoneBand[] = [
  {
    zone: "Extreme Fear",
    from: 0,
    to: 30,
    stroke: "rgb(var(--azee-sky))",
    text: "rgb(var(--azee-sky))",
    wash: "rgb(var(--azee-sky) / 0.14)",
  },
  {
    zone: "Fear",
    from: 30,
    to: 45,
    stroke: "rgb(var(--azee-sky) / 0.5)",
    text: "rgb(var(--azee-sky) / 0.85)",
    wash: "rgb(var(--azee-sky) / 0.08)",
  },
  {
    zone: "Neutral",
    from: 45,
    to: 55,
    stroke: "rgb(var(--azee-chalk) / 0.32)",
    text: "rgb(var(--azee-chalk) / 0.75)",
    wash: "rgb(var(--azee-chalk) / 0.05)",
  },
  {
    zone: "Optimism",
    from: 55,
    to: 70,
    // 0.55 over the navy ground rendered as a muddy maroon rather
    // than a lighter orange — orange darkens fast against blue.
    stroke: "rgb(var(--azee-orange) / 0.72)",
    text: "rgb(var(--azee-orange) / 0.9)",
    wash: "rgb(var(--azee-orange) / 0.08)",
  },
  {
    zone: "Extreme Optimism",
    from: 70,
    to: 100,
    stroke: "rgb(var(--azee-orange))",
    text: "rgb(var(--azee-orange))",
    wash: "rgb(var(--azee-orange) / 0.14)",
  },
];

const BY_ZONE = new Map(ZONE_BANDS.map((band) => [band.zone, band]));

/** The band for a zone. Every SentimentZone has one by construction. */
export function zoneStyle(zone: SentimentZone): ZoneBand {
  return BY_ZONE.get(zone)!;
}
