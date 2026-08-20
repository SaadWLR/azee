import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { KNOWLEDGE_HERO_VIDEO_URL } from "../config";
import { KNOWLEDGE_MODULES, KNOWLEDGE_TOTAL_HOURS } from "../data/knowledge";
import { usePageMeta } from "../hooks/usePageMeta";
import { useBackgroundVideo } from "../hooks/useBackgroundVideo";
import type { KnowledgeLevel } from "../types/knowledge";

/** Cool-toned level badges, consistent with the site's blue palette. */
const LEVEL_BADGE: Record<KnowledgeLevel, string> = {
  Beginner: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Intermediate: "border-blue-300/25 bg-blue-400/10 text-blue-200",
  Advanced: "border-indigo-300/25 bg-indigo-400/10 text-indigo-200",
};

/**
 * Knowledge Centre landing page: a typography-forward hero over the
 * site's global Navbar, with the module grid scrolling in below.
 *
 * VIDEO DEMOTED, NOT REMOVED. The blue-hour footage used to be a
 * full-bleed, full-viewport-height background — the dominant visual of
 * the page. It is still here, still the same asset, still autoplaying
 * muted on a loop, but now inside a small framed 16:9 panel beside the
 * copy rather than behind everything.
 *
 * WHY: checked directly against Robinhood, Wise, Fidelity and Trading
 * 212 — in every case the PRIMARY hero visual is something real (a
 * product screenshot, a functional tool, real photography), never
 * full-bleed decorative footage. The Hero on the homepage keeps its
 * full-bleed treatment because it has a real anchor sitting beside it,
 * the live Market Snapshot panel. This hero had no such anchor, so the
 * footage was carrying the whole section on atmosphere alone.
 *
 * WHAT TAKES THE PRIMARY POSITION: the page's own real structural
 * facts — the actual module count, the actual total hours, and the real
 * level range, all read from KNOWLEDGE_MODULES rather than written into
 * the markup — set in the site's existing typography-forward style (the
 * same eyebrow / oversized heading / brand stripe used on every other
 * page). The section also no longer occupies a full viewport height, so
 * the real syllabus below reaches the reader sooner.
 *
 * The .kc-fade-up entrance is deliberately kept: it is a one-shot
 * entrance, not ambient looping motion.
 */
export function KnowledgeCentrePage() {
  usePageMeta(
    "Knowledge Centre — Investor Education | AZEE Trade",
    "Structured investor education for the Pakistan Stock Exchange — eight modules from market basics to advanced trading, spanning beginner to advanced level.",
  );
  const { videoRef, onError } = useBackgroundVideo();

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      {/* ── Typography-forward hero, video as a supporting panel ──── */}
      <section className="relative w-full overflow-hidden bg-black">
        {/* A single static navy bloom — the atmosphere the full-bleed
            footage used to provide, at a fraction of its weight. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgb(var(--azee-royal)/0.28),transparent_70%)]"
        />

        <div className="relative z-10 px-4 pb-16 pt-[calc(var(--nav-height)+3rem)] sm:px-6 lg:px-12 lg:pb-20">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
            {/* PRIMARY: the page's own real structure, in type. */}
            <div>
            <p
              className="kc-fade-up text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/90"
              style={{ animationDelay: "0.1s" }}
            >
              AZEE Knowledge Centre
            </p>

            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              <span className="kc-fade-up block" style={{ animationDelay: "0.25s" }}>
                Understand the market.
              </span>
              <span className="kc-fade-up block" style={{ animationDelay: "0.4s" }}>
                Invest with intent.
              </span>
            </h1>

            {/* Brand-signature stripe — same motif as the hero headline;
                fades in with the page's own staggered entrance (between
                the heading at 0.4s and the description at 0.55s). */}
            <div
              className="kc-fade-up mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]"
              style={{ animationDelay: "0.5s" }}
            />

            <p
              className="kc-fade-up mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg"
              style={{ animationDelay: "0.55s" }}
            >
              Structured investor education for the Pakistan Stock Exchange.
              Eight modules, from market basics to advanced trading — designed
              to take you from beginner to confident investor.
            </p>

            {/* Real structural metadata (was IMDB/runtime/date in the
                reference): module count, total time, level range. */}
            <div
              className="kc-fade-up mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-200"
              style={{ animationDelay: "0.7s" }}
            >
              <span>
                <strong className="font-semibold text-white">
                  {KNOWLEDGE_MODULES.length}
                </strong>{" "}
                modules
              </span>
              <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden="true" />
              <span>
                ~
                <strong className="font-semibold text-white">
                  {KNOWLEDGE_TOTAL_HOURS}
                </strong>{" "}
                hours
              </span>
              <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden="true" />
              <span>Beginner to Advanced</span>
            </div>

            <div
              className="kc-fade-up mt-9 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
              style={{ animationDelay: "0.85s" }}
            >
              <a
                href="#modules"
                className="kc-glass rounded-full px-8 py-3.5 text-center text-sm font-semibold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
              >
                Explore Modules
              </a>
              <Link
                to="/#research"
                className="rounded-full px-8 py-3.5 text-center text-sm font-semibold text-gray-200 transition-colors duration-300 hover:text-white sm:w-auto"
              >
                View Research →
              </Link>
            </div>
            </div>

            {/*
             * SECONDARY: the same blue-hour footage this hero always
             * used, kept and still playing — now a framed 16:9 panel
             * beside the copy instead of a full-bleed background behind
             * it. Decorative, so it stays aria-hidden; the section's
             * meaning is carried entirely by the type to its left.
             */}
            <div
              className="kc-fade-up relative aspect-video overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              style={{ animationDelay: "0.95s" }}
              aria-hidden="true"
            >
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                src={KNOWLEDGE_HERO_VIDEO_URL}
                onError={onError}
                autoPlay
                muted
                loop
                playsInline
              />
              {/* Slight navy tint so the panel sits in the palette
                  rather than glowing out of it. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--azee-navy)/0.45),transparent_60%)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Module grid ───────────────────────────────────────────── */}
      <section
        id="modules"
        className="section-tint-b relative px-4 py-20 sm:px-6 lg:px-12 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Learning Modules
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Build your investing knowledge, module by module.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
            Structured lessons are being written now. Explore the syllabus
            below — each module opens with its outline and a note on what's
            coming.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {KNOWLEDGE_MODULES.map((module) => (
              <Link
                key={module.slug}
                to={`/knowledge-centre/${module.slug}`}
                className="liquid-glass card-glow group flex flex-col justify-between rounded-3xl p-6 hover:bg-white/[0.12]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${LEVEL_BADGE[module.level]}`}
                    >
                      {module.level}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Coming soon
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-white">
                    {module.title}
                  </h3>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-xs text-gray-400 tabular-nums">
                    {module.chapterCount} chapters · ~{module.estimatedMinutes} min
                  </p>
                  <span
                    aria-hidden="true"
                    className="text-white/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
                  >
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
