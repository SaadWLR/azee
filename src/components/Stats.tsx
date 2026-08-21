import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

interface Stat {
  value: number;
  suffix: string;
  label: string;
  sub: string;
}

const STATS: Stat[] = [
  {
    value: 20,
    suffix: "+",
    label: "Years in Capital Markets",
    sub: "PSX & PMEX member since 2003",
  },
  {
    value: 10000,
    suffix: "+",
    label: "Investors Served",
    sub: "Retail, HNW, and overseas Pakistanis",
  },
  {
    value: 450,
    suffix: "+",
    label: "Margin-Eligible Symbols",
    sub: "Leverage through margin pledge",
  },
  {
    value: 2,
    suffix: "",
    label: "Regulated Exchanges",
    sub: "Pakistan Stock & Mercantile Exchanges",
  },
];

/**
 * Counts from 0 to `target` the first time the element is visible.
 *
 * THE FAILURE THIS GUARDS AGAINST: the displayed value used to start at
 * 0 and only leave 0 once requestAnimationFrame began firing. rAF is
 * throttled to zero in a backgrounded tab, and browsers also withhold
 * it under low-power mode and in automated/hidden contexts — so the row
 * could paint and sit at "0+ Years in Capital Markets" and "0+ Investors
 * Served". That is not a cosmetic glitch on a licensed brokerage; it is
 * a false statement about the firm rendered in its own trust section.
 *
 * The fix inverts the default. Animating is now the EXCEPTION, taken
 * only when the frame clock can actually be trusted to run; every other
 * path renders the true figure immediately. Three independent
 * guarantees, so no single one has to hold:
 *
 *   1. Pre-flight — if rAF is missing, the visitor prefers reduced
 *      motion, or the page is hidden at the moment the row scrolls into
 *      view, the final value is set at once and no animation starts.
 *   2. Watchdog — once animating, a timer set to the full duration plus
 *      a grace period forces the final value. If rAF stalls midway
 *      (tab backgrounded during the count) this still resolves it.
 *   3. Visibility — if the tab is hidden mid-count, the value jumps to
 *      final immediately rather than freezing at whatever it reached.
 *
 * The normal case is untouched: a visitor on a foreground tab with
 * motion enabled sees exactly the same eased count-up as before.
 */
function useInViewCount(target: number, duration = 1800) {
  const ref = useRef<HTMLDivElement>(null);
  /*
   * Starts at the TRUE figure, not at 0. The count-up drops it to 0 and
   * runs only once the animation is actually committed to (below), so
   * "0+" is never the resting state of the markup — a full-page
   * screenshot or a crawler reading the page before the row is scrolled
   * to now finds "20+ Years in Capital Markets", not "0+".
   */
  const [value, setValue] = useState(target);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let onVisibility: (() => void) | undefined;

    /** The truth. Every non-animating path lands here. */
    const settle = () => {
      if (raf) cancelAnimationFrame(raf);
      if (watchdog) clearTimeout(watchdog);
      setValue(target);
    };

    /** Can the frame clock be trusted to actually run right now? */
    const canAnimate = () =>
      typeof requestAnimationFrame === "function" &&
      typeof document !== "undefined" &&
      !document.hidden &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (typeof IntersectionObserver === "undefined") {
      settle();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        // (1) Pre-flight: no trustworthy frame clock ⇒ leave the figure
        // exactly as it is. It already holds the true value.
        if (!canAnimate()) {
          settle();
          return;
        }

        /*
         * Committed to animating: only NOW does the value drop to 0.
         * The observer's rootMargin fires this while the row is still
         * below the fold, so the reset happens off-screen and the
         * visitor scrolls into a count already in progress — never a
         * flash of the final figure snapping back to zero.
         */
        setValue(0);
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(target * eased));
          if (t < 1) {
            raf = requestAnimationFrame(tick);
          } else if (watchdog) {
            clearTimeout(watchdog);
          }
        };
        raf = requestAnimationFrame(tick);

        // (2) Watchdog: a stalled rAF can never leave the value short.
        watchdog = setTimeout(settle, duration + 400);

        // (3) Backgrounded mid-count ⇒ resolve rather than freeze.
        onVisibility = () => {
          if (document.hidden) settle();
        };
        document.addEventListener("visibilitychange", onVisibility);
      },
      /*
       * Fires ~240px BEFORE the row reaches the viewport, so the
       * reset-to-zero and the first frames happen off-screen. threshold
       * 0 because with a positive rootMargin the element is not visible
       * yet — there is no fraction of it on screen to require.
       */
      { threshold: 0, rootMargin: "240px 0px" },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (watchdog) clearTimeout(watchdog);
      if (onVisibility) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [target, duration]);

  return { ref, value };
}

function StatCard({ stat, delay }: { stat: Stat; delay: number }) {
  const { ref, value } = useInViewCount(stat.value);

  return (
    <Reveal delay={delay} className="h-full">
      <div
        ref={ref}
        className="liquid-glass glass-sheen card-glow h-full rounded-3xl p-8 text-center hover:bg-white/[0.12]"
      >
        {/* The number itself carries the one warm accent — these are the
            firm's real, static achievement figures (not live gain/loss
            data), so orange here is a deliberate brand touch, not a
            financial-color signal. Label, sub-text, card, and layout are
            unchanged; every other section stays blue. */}
        <p className="text-4xl font-bold tracking-tight text-[rgb(var(--azee-orange))] tabular-nums sm:text-5xl">
          {value.toLocaleString("en-US")}
          <span className="text-[rgb(var(--azee-orange)/0.7)]">{stat.suffix}</span>
        </p>
        <p className="mt-3 text-sm font-semibold text-white">{stat.label}</p>
        <p className="mt-1.5 text-xs text-gray-400">{stat.sub}</p>
      </div>
    </Reveal>
  );
}

/** Slow-drifting particles, echoing the hero's field. */
const PARTICLES = [
  { left: "6%", size: 3, duration: 26, delay: 0 },
  { left: "22%", size: 2, duration: 30, delay: 8 },
  { left: "38%", size: 2, duration: 24, delay: 4 },
  { left: "55%", size: 3, duration: 32, delay: 12 },
  { left: "71%", size: 2, duration: 27, delay: 2 },
  { left: "89%", size: 3, duration: 29, delay: 9 },
];

export function Stats() {
  return (
    <section className="section-tint-a relative overflow-hidden py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: p.left,
              bottom: "-2%",
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}
