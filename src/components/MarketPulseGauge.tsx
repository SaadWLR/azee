import { Link } from "react-router-dom";
import { SentimentDial } from "./SentimentDial";
import { useFearOptimismIndex } from "../hooks/useMarketData";
import { zoneStyle } from "../lib/sentimentZones";

/**
 * The Fear and Optimism Index, as a homepage teaser.
 *
 * WHAT THIS USED TO BE, AND WHY IT SHRANK. It carried the whole thing:
 * the dial, all eight signals, every calibrating note and the
 * disclaimer, inline in the hero. That was the right shape when there
 * was nowhere else for the detail to live. Now there is a dedicated
 * page, and repeating its contents in the hero costs ~360px of the
 * first screen to say the same thing twice.
 *
 * So this keeps only what a teaser owes a reader: the number, the zone
 * it falls in, how much of the index is actually behind that number,
 * and a way through to the rest. The honesty requirement travels with
 * it — "N of 8 signals live" is still here, because a bare score in a
 * hero implies a complete index, and stating the denominator is the
 * one thing this panel cannot drop while getting smaller.
 *
 * The dial is shared with the full page rather than reimplemented, so
 * the needle cannot land in two different places for one reading.
 */
export function MarketPulseGauge() {
  const { data, loading, error } = useFearOptimismIndex();

  const liveCount =
    data?.signals.filter((s) => s.status === "live").length ?? 0;
  const total = data?.signals.length ?? 8;

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
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: zoneStyle(data.zone).text }}
          >
            {data.zone}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-[13px] leading-relaxed text-white/60">
          The Fear and Optimism Index is unavailable right now — the PSX feeds
          did not respond.
        </p>
      ) : (
        <div className="mt-4 flex items-center gap-6">
          <div className="w-[150px] shrink-0 sm:w-[170px]">
            <SentimentDial score={data?.score} zone={data?.zone} />
          </div>

          <div className="min-w-0 flex-1">
            {data?.score !== undefined ? (
              <p className="text-4xl font-bold leading-none tabular-nums tracking-tight text-[rgb(var(--azee-chalk))]">
                {data.score}
              </p>
            ) : (
              <p className="text-[13px] font-medium text-white/60">
                {loading ? "Reading the market…" : "No live signal yet"}
              </p>
            )}

            {/*
             * The denominator, stated rather than implied. A reader who
             * knows this kind of index expects eight inputs; saying how
             * many are actually behind the needle is the difference
             * between a partial reading and a misleading one.
             */}
            <p className="mt-2 text-[11px] text-white/50">
              {liveCount} of {total} signals live
              {data?.stale ? " · last known values" : ""}
            </p>

            <Link
              to="/fear-and-optimism-index"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[rgb(var(--azee-orange))] transition-colors duration-300 hover:text-[rgb(var(--azee-chalk))]"
            >
              See the full index
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
