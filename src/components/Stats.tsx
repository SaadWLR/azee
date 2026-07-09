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

/** Counts from 0 to `target` the first time the element is visible. */
function useInViewCount(target: number, duration = 1800) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    if (typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(target * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
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
        className="liquid-glass glass-sheen h-full rounded-3xl p-8 text-center transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.14]"
      >
        <p className="text-4xl font-bold tracking-tight text-white tabular-nums sm:text-5xl">
          {value.toLocaleString("en-US")}
          <span className="text-white/70">{stat.suffix}</span>
        </p>
        <p className="mt-3 text-sm font-semibold text-white">{stat.label}</p>
        <p className="mt-1 text-xs text-gray-300">{stat.sub}</p>
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
    <section className="relative overflow-hidden bg-black py-24 lg:py-32">
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
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
