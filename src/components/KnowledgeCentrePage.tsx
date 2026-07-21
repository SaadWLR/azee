import { type MouseEvent } from "react";
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
 * Knowledge Centre landing page: an animated, moonlit video hero over
 * the site's global Navbar, with the module grid scrolling in below.
 * The hero reuses Hero.tsx's video technique (playbackRate 0.75, muted
 * autoplay loop, soft mouse-parallax) but its own moonlight footage and
 * its own .kc-glass / .kc-fade-up styling — no second navbar, no
 * fabricated content.
 */
export function KnowledgeCentrePage() {
  usePageMeta(
    "Knowledge Centre — Investor Education | AZEE Trade",
    "Structured investor education for the Pakistan Stock Exchange — eight modules from market basics to advanced trading, spanning beginner to advanced level.",
  );
  const { videoRef, onError } = useBackgroundVideo();

  // Soft parallax: the over-scaled video drifts a few pixels against
  // the cursor (identical feel to the homepage hero).
  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 8;
    video.style.transform = `scale(1.06) translate(${-x}px, ${-y}px)`;
  };

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      {/* ── Animated moonlit hero ─────────────────────────────────── */}
      <section
        className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black"
        onMouseMove={handleMouseMove}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out"
          style={{ transform: "scale(1.06)" }}
          src={KNOWLEDGE_HERO_VIDEO_URL}
          onError={onError}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Moonlight-blue wash + dark gradient so the bottom content
            reads clearly over the footage. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgb(var(--azee-royal)/0.35),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/35"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgb(var(--azee-navy)/0.55),transparent)]"
        />

        {/* Bottom-aligned content column. */}
        <div className="relative z-10 flex flex-1 items-end px-4 pb-16 pt-[calc(var(--nav-height)+2rem)] sm:px-6 lg:px-12 lg:pb-24">
          <div className="mx-auto w-full max-w-7xl">
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
