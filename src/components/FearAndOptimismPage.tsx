import type { ReactNode } from "react";
import { Accordion } from "./Accordion";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { SentimentChart } from "./SentimentChart";
import { SentimentDial } from "./SentimentDial";
import {
  IconBars,
  IconGlobe,
  IconIngots,
  IconLayers,
  IconPeaks,
  IconScales,
  IconTrendBars,
  IconWaves,
} from "./Icons";
import { useFearOptimismDetail } from "../hooks/useMarketData";
import { ZONE_BANDS, zoneStyle } from "../lib/sentimentZones";
import { usePageMeta } from "../hooks/usePageMeta";
import { zoneForScore } from "../services/sentimentService";
import type { HistoricalScore } from "../services/sentimentService";
import type { SentimentSignal, SentimentZone } from "../types/sentiment";

/**
 * The Fear and Optimism Index, in full.
 *
 * EVERY CLAIM ON THIS PAGE IS DERIVED, NOT TYPED. The number of live
 * signals, which ones they are, what each measures and why an inactive
 * one is inactive all come from sentimentService at render time. That
 * is deliberate: a page that explains a methodology is exactly the
 * place where hardcoded copy rots first, and "three of eight signals"
 * baked into a paragraph would keep saying three long after Breadth
 * graduates. Nothing here counts signals by hand.
 *
 * Presentation only — no fetching, no scoring. Both belong upstream.
 */

/** One mark per signal, keyed the same way the service keys them. */
const SIGNAL_ICONS: Record<
  string,
  (props: { className?: string }) => ReactNode
> = {
  momentum: IconTrendBars,
  volatility: IconWaves,
  priceStrength: IconPeaks,
  volumeMomentum: IconBars,
  breadth: IconScales,
  safeHaven: IconIngots,
  derivatives: IconLayers,
  foreignFlows: IconGlobe,
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/* ── Small building blocks ──────────────────────────────────────── */

function ZonePill({ zone }: { zone: SentimentZone }) {
  const style = zoneStyle(zone);
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={{ color: style.text, background: style.wash }}
    >
      {zone}
    </span>
  );
}

function CalibratingBadge() {
  return (
    <span className="inline-flex rounded-full border border-white/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
      Calibrating
    </span>
  );
}

/** Where a live score sits across the whole 0-100 range. */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mt-4">
      <div
        className="relative h-1.5 w-full rounded-full"
        style={{
          background: `linear-gradient(to right, ${ZONE_BANDS.map(
            (b) => `${b.stroke} ${b.from}%, ${b.stroke} ${b.to}%`,
          ).join(", ")})`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[rgb(var(--azee-navy))] bg-[rgb(var(--azee-chalk))]"
          style={{ left: `${score}%` }}
        />
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: SentimentSignal }) {
  const Icon = SIGNAL_ICONS[signal.key];
  const live = signal.status === "live" && typeof signal.score === "number";

  return (
    <li className="rounded-3xl border border-white/12 bg-[rgb(var(--azee-panel))] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon ? (
            <Icon className="h-5 w-5 text-[rgb(var(--azee-orange))]" />
          ) : null}
          <span className="text-[15px] font-semibold text-[rgb(var(--azee-chalk))]">
            {signal.label}
          </span>
        </div>
        {live ? (
          <ZonePill zone={zoneForScore(signal.score!)} />
        ) : (
          <CalibratingBadge />
        )}
      </div>

      {live ? (
        <>
          <p className="font-display mt-5 text-[2.25rem] leading-none tabular-nums text-[rgb(var(--azee-chalk))]">
            {signal.score}
          </p>
          <ScoreBar score={signal.score!} />
          <p className="mt-4 text-[13px] leading-relaxed text-white/55">
            {signal.description}
          </p>
        </>
      ) : (
        /*
         * The note stands where the number would be. The reader's
         * question about an inactive signal is "why", and the answer is
         * the only thing this card has to give — so it is given the
         * space the score would have taken rather than a footnote.
         *
         * Copy comes from sentimentService, never rewritten here: one
         * source of truth for why a signal is dark.
         */
        <p className="mt-5 text-[13px] leading-relaxed text-white/60">
          {signal.calibratingNote}
        </p>
      )}
    </li>
  );
}

function StatCard({
  label,
  value,
  zone,
}: {
  label: string;
  value: string;
  zone?: SentimentZone;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {label}
      </p>
      <p className="font-display mt-2 text-[1.5rem] leading-none tabular-nums text-[rgb(var(--azee-chalk))]">
        {value}
      </p>
      {zone ? (
        <p
          className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: zoneStyle(zone).text }}
        >
          {zone}
        </p>
      ) : null}
    </div>
  );
}

/* ── Zone education ─────────────────────────────────────────────── */

/*
 * Written for a PSX reader. The substance is the standard reading of
 * each band; the wording is ours, and each one is deliberately
 * caveat-forward — these describe what a level has historically
 * coincided with, not what anyone should do about it.
 */
const ZONE_GUIDE: { zone: SentimentZone; body: string }[] = [
  {
    zone: "Extreme Fear",
    body: "Signals are near the bottom of their own two-year range at the same time. Historically this has coincided with heavy selling and thin participation. It says conditions are unusually poor by this market's own standards — it does not say the bottom is in, and markets have stayed fearful for months.",
  },
  {
    zone: "Fear",
    body: "Readings sit below their normal range without being extreme. Typically a market working through bad news: falling prices, rising volatility, and buyers unwilling to commit size.",
  },
  {
    zone: "Neutral",
    body: "Signals are close to their own two-year medians. Neither stress nor enthusiasm dominates, and the index is telling you very little — which is itself useful information about how much weight to give it.",
  },
  {
    zone: "Optimism",
    body: "Readings sit above their usual range: prices trending up, volatility settled, volume following the move. A market being rewarded for risk, with the caution that this is when positions are easiest to add and hardest to size sensibly.",
  },
  {
    zone: "Extreme Optimism",
    body: "Signals are near the top of their two-year range together. Historically associated with crowded positioning and complacency about downside. As with Extreme Fear, it describes the present — an extreme can persist far longer than it looks like it should.",
  },
];

/* ── The page ───────────────────────────────────────────────────── */

export function FearAndOptimismPage() {
  usePageMeta(
    "Fear and Optimism Index — PSX Market Sentiment | AZEE Trade",
    "A sentiment gauge for the Pakistan Stock Exchange, built from PSX market signals with each ranked against its own two-year history. See the current reading, how it has moved, and exactly which signals are live.",
  );

  const { data, loading, error } = useFearOptimismDetail();
  const index = data?.index;
  const signals = index?.signals ?? [];
  const live = signals.filter((s) => s.status === "live");
  const liveCount = live.length;
  const total = signals.length || 8;

  const chips = data?.chips;
  const series = data?.series ?? [];

  /*
   * Every count in the prose below is read from the data. The word for
   * the number too — "Three signals" reads better than "3 signals" and
   * would be the first thing to go stale if it were typed.
   */
  const spelled =
    ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"][
      liveCount
    ] ?? String(liveCount);

  const comparisons: { label: string; entry?: HistoricalScore }[] = [
    { label: "1 Week Ago", entry: chips?.oneWeekAgo },
    { label: "1 Month Ago", entry: chips?.oneMonthAgo },
    { label: "1 Year Ago", entry: chips?.oneYearAgo },
  ];

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      {/* ── A. Header ─────────────────────────────────────────── */}
      <section className="relative bg-[rgb(var(--azee-navy))] px-4 pb-16 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Market Sentiment</p>
          <h1 className="font-display mt-6 text-[2.5rem] text-[rgb(var(--azee-chalk))] sm:text-5xl">
            Fear and Optimism Index
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-white/65 sm:text-base">
            A sentiment reading for the Pakistan Stock Exchange, built from PSX
            market signals with each one ranked against its own history rather
            than scored on a fixed curve. A signal at 80 is higher than 80% of
            its readings over roughly the past two years, so the number
            describes this market against its own past — not against a
            benchmark chosen by us.{" "}
            {loading ? null : (
              <>
                {spelled === "one" ? "One signal is" : `${spelled[0].toUpperCase()}${spelled.slice(1)} signals are`}{" "}
                live today of {total}; the rest are listed below with what each
                one is still waiting for.
              </>
            )}
          </p>

          {/* Zone legend */}
          <ul className="mt-8 flex flex-wrap gap-2">
            {ZONE_BANDS.map((band) => (
              <li
                key={band.zone}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: band.stroke }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75">
                  {band.zone}
                </span>
                <span className="text-[11px] tabular-nums text-white/45">
                  {band.from}–{band.to}
                </span>
              </li>
            ))}
          </ul>

          {/*
           * Comparison cards. Only the ones the reconstruction actually
           * reaches back to are rendered — a "1 Year Ago" card reading
           * "—" would be a placeholder pretending to be a measurement,
           * so an absent comparison is simply an absent card.
           */}
          {chips ? (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="vs Previous Close"
                value={`${chips.vsPreviousClose >= 0 ? "+" : ""}${chips.vsPreviousClose} pts`}
              />
              {comparisons.map(({ label, entry }) =>
                entry ? (
                  <StatCard
                    key={label}
                    label={label}
                    value={String(entry.score)}
                    zone={entry.zone}
                  />
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── B. The gauge ──────────────────────────────────────── */}
      <section className="relative bg-[rgb(var(--azee-navy))] px-4 pb-20 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          {error ? (
            <p className="text-sm text-white/60">
              The index is unavailable right now — the PSX feeds did not
              respond.
            </p>
          ) : (
            <>
              <SentimentDial
                variant="detailed"
                score={index?.score}
                zone={index?.zone}
              />
              {index?.score !== undefined ? (
                <>
                  <p className="font-display -mt-2 text-[3.5rem] leading-none tabular-nums text-[rgb(var(--azee-chalk))] sm:text-[4rem]">
                    {index.score}
                  </p>
                  <div className="mt-4">
                    <ZonePill zone={index.zone!} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-white/60">
                  {loading ? "Reading the market…" : "No live signal yet"}
                </p>
              )}
              <p className="mt-5 text-xs text-white/45">
                {liveCount} of {total} signals live
                {index?.asOf ? ` · as of ${fmtDate(index.asOf)}` : ""}
                {" · "}
                {/*
                 * Our real cadence, not a borrowed one. Every live
                 * signal is computed from PSX's end-of-day archive,
                 * which publishes once after the close — so the reading
                 * changes once per trading day, and saying "live" or
                 * "real-time" here would be false.
                 */}
                updates once per trading day, after the PSX close
                {index?.stale ? " · showing last known values" : ""}
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── C. Historical chart ───────────────────────────────── */}
      <section
        data-nav-theme-section="light"
        className="relative bg-[rgb(var(--azee-paper))] px-4 py-20 sm:px-6 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-[rgb(var(--azee-navy))] p-6 sm:p-10">
            <SentimentChart series={series} />
          </div>
        </div>
      </section>

      {/* ── D. What's driving it ──────────────────────────────── */}
      <section className="relative bg-[rgb(var(--azee-navy))] px-4 py-20 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">What&apos;s driving it</p>
          <h2 className="font-display mt-6 text-[1.75rem] text-[rgb(var(--azee-chalk))] sm:text-[2rem]">
            Every signal, and where it stands
          </h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-white/60">
            The composite is the simple average of the signals that are live —
            currently {liveCount} of {total}. A signal still calibrating
            contributes nothing rather than a neutral placeholder, because a
            placeholder would drag every reading toward the middle and quietly
            turn this into a measure of how much is still unbuilt.
          </p>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {signals.map((signal) => (
              <SignalCard key={signal.key} signal={signal} />
            ))}
          </ul>
        </div>
      </section>

      {/* ── E. How to read it ─────────────────────────────────── */}
      <section
        data-nav-theme-section="light"
        className="relative bg-[rgb(var(--azee-paper))] px-4 py-20 sm:px-6 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">How to read it</p>
          <h2 className="font-display mt-6 max-w-3xl text-[1.75rem] text-[rgb(var(--azee-navy))] sm:text-[2rem]">
            &ldquo;Be fearful when others are greedy, and greedy when others are
            fearful.&rdquo;
          </h2>
          <p className="mt-4 text-sm text-[rgb(var(--azee-navy)/0.62)]">
            — Warren Buffett. The idea behind every sentiment index: crowds tend
            to be most confident at the worst moments to follow them. What
            follows is what each band has historically described, not what to do
            about it.
          </p>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ZONE_GUIDE.map((entry) => (
              <li
                key={entry.zone}
                className="rounded-3xl border border-[rgb(var(--azee-navy)/0.14)] p-6"
              >
                <span
                  className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    color: zoneStyle(entry.zone).text,
                    background: zoneStyle(entry.zone).wash,
                  }}
                >
                  {entry.zone}
                </span>
                <p className="mt-4 text-[13px] leading-relaxed text-[rgb(var(--azee-navy)/0.72)]">
                  {entry.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-3xl border-l-4 border-[rgb(var(--azee-orange))] bg-[rgb(var(--azee-orange)/0.06)] px-6 py-5">
            <p className="text-[13px] leading-relaxed text-[rgb(var(--azee-navy)/0.8)]">
              The Fear and Optimism Index is an information tool, not investment
              advice — it describes market sentiment, not a recommendation to
              buy or sell securities. Investing in equities involves risk.
            </p>
          </div>
        </div>
      </section>

      {/* ── F. Methodology ────────────────────────────────────── */}
      <section className="relative bg-[rgb(var(--azee-navy))] px-4 py-20 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Methodology</p>
          <h2 className="font-display mt-6 text-[1.75rem] text-[rgb(var(--azee-chalk))] sm:text-[2rem]">
            How the number is produced
          </h2>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                {
                  title: "Ranked, not scored",
                  body: "Each signal's raw reading is compared against roughly 500 of its own prior sessions — about two years — and the score is its percentile within that history. There are no manual adjustments, no weightings applied by hand, and no thresholds chosen to make a reading look a particular way. A signal is only ranked once a full window of history exists behind it; until then it stays calibrating rather than being ranked against a short sample.",
                },
                {
                  title: "Equally weighted",
                  body: "The composite is a plain average of the live signals. No signal is judged more important than another, because deciding which matters more would be exactly the kind of discretionary call percentile ranking exists to remove.",
                },
                {
                  title: "Once per trading day",
                  body: "Every live signal is computed from the PSX end-of-day archive, which publishes after the close. The reading therefore changes once per trading day rather than tick by tick. Market breadth is recorded separately each evening so it can eventually be ranked the same way.",
                },
              ].map((card) => (
                <li
                  key={card.title}
                  className="rounded-3xl border border-white/12 bg-[rgb(var(--azee-panel))] p-6"
                >
                  <h3 className="text-[15px] font-semibold text-[rgb(var(--azee-chalk))]">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                    {card.body}
                  </p>
                </li>
              ))}
            </ul>

            {/*
             * The technical breakdown. Labels, statuses and one-line
             * descriptions all come from sentimentService — the same
             * strings the cards above render — so this list cannot
             * describe a signal differently from the rest of the page.
             */}
            <div className="rounded-3xl border border-white/12 p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
                Signal breakdown
              </h3>
              <ul className="mt-4 divide-y divide-white/10">
                {signals.map((signal) => (
                  <li key={signal.key} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-[rgb(var(--azee-chalk))]">
                        {signal.label}
                      </span>
                      {signal.status === "live" ? (
                        <span className="shrink-0 rounded-full bg-[rgb(var(--azee-orange)/0.16)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[rgb(var(--azee-orange))]">
                          Live
                        </span>
                      ) : (
                        <CalibratingBadge />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/50">
                      {signal.description}
                    </p>
                  </li>
                ))}
              </ul>

              {/*
               * Sources names only what actually feeds the index today.
               * Listing gold, currency, futures or foreign-flow
               * providers here would describe a page we have not built.
               */}
              <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/45">
                Sources: Pakistan Stock Exchange official market data (advancers,
                decliners and traded volume) and the PSX KSE-100 end-of-day
                timeseries. No other data source feeds this index today.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── G. FAQ ────────────────────────────────────────────── */}
      <section
        data-nav-theme-section="light"
        className="relative bg-[rgb(var(--azee-paper))] px-4 py-20 sm:px-6 lg:px-12"
      >
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Questions</p>
          <h2 className="font-display mt-6 text-[1.75rem] text-[rgb(var(--azee-navy))] sm:text-[2rem]">
            Common questions
          </h2>

          <div className="mt-8 [&_button_span]:!text-[rgb(var(--azee-navy))] [&_div[role=region]]:!text-[rgb(var(--azee-navy)/0.72)] [&_div]:!border-[rgb(var(--azee-navy)/0.12)]">
            <Accordion
              items={[
                {
                  question: "What is the Fear and Optimism Index?",
                  answer:
                    "A single 0-100 reading of how the Pakistan Stock Exchange is behaving relative to its own recent past. It combines several market signals — trend, volatility, trading volume and market breadth among them — into one number, where low readings describe fearful conditions and high readings describe optimistic ones.",
                },
                {
                  question: "How is it calculated?",
                  answer: `Each signal's raw value is computed from PSX data, then ranked as a percentile against roughly 500 of its own prior sessions — about two years. A score of 70 means the signal is higher than 70% of its own history. The composite is the simple, equally weighted average of the signals that are currently live: ${liveCount} of ${total}. Signals without enough history to be ranked fairly are shown as calibrating and are left out of the average entirely rather than contributing a neutral value.`,
                },
                {
                  question: "How often does it update?",
                  answer:
                    "Once per trading day. Every live signal derives from the PSX end-of-day archive, which publishes after the close, so the reading settles once a session rather than moving intraday.",
                },
                {
                  question:
                    "How is this different from CNN's Fear & Greed Index?",
                  answer:
                    "It is built for the Pakistan Stock Exchange specifically, from PSX's own data. CNN's index measures US equities using inputs such as US junk-bond spreads and S&P 500 put/call ratios — instruments that either do not exist in Pakistan or are not published here. The shared idea is percentile-ranking several signals into one number; the signals themselves are not the same, and the two readings are not comparable.",
                },
                {
                  question:
                    "Should I act on Extreme Fear or Extreme Optimism readings?",
                  answer:
                    "This index is not a trading signal and nothing here is advice. Extremes describe conditions that are unusual by this market's own standards, and they can persist for months — a market can stay fearful while it keeps falling and stay optimistic while it keeps rising. Treat it as one piece of context alongside your own research, your time horizon and your risk tolerance, and speak to a licensed adviser about your particular circumstances.",
                },
                {
                  question: "Can it predict where the KSE-100 goes next?",
                  answer:
                    "No. It measures current conditions from data that has already happened — trends, volatility and volume that are already in the record. It carries no forecast, and no reading of it should be read as one.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
