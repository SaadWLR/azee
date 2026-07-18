import { Link, useParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { getKnowledgeModule } from "../data/knowledge";
import type { KnowledgeLevel, KnowledgeModule } from "../types/knowledge";

const LEVEL_BADGE: Record<KnowledgeLevel, string> = {
  Beginner: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Intermediate: "border-blue-300/25 bg-blue-400/10 text-blue-200",
  Advanced: "border-indigo-300/25 bg-indigo-400/10 text-indigo-200",
};

/**
 * One dynamic route (/knowledge-centre/:moduleSlug) for all modules,
 * driven by the typed registry. An unknown slug renders a graceful
 * not-found state rather than crashing. A known module shows its real
 * structural metadata and an honest "content coming soon" state — no
 * invented chapter titles or lesson text.
 */
export function KnowledgeModulePage() {
  const { moduleSlug } = useParams();
  const knowledgeModule = getKnowledgeModule(moduleSlug);

  return (
    <main className="min-h-screen text-white">
      <Navbar />
      {knowledgeModule ? (
        <ModuleView module={knowledgeModule} />
      ) : (
        <ModuleNotFound />
      )}
      <Footer />
    </main>
  );
}

function ModuleView({ module }: { module: KnowledgeModule }) {
  // The chapter *count* is real; titles are not written yet, so the
  // outline is numbered placeholders only — never invented titles.
  const chapters = Array.from({ length: module.chapterCount }, (_, i) => i + 1);

  return (
    <section className="section-tint-a relative px-4 pb-24 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/knowledge-centre"
          className="text-xs font-semibold text-blue-300/90 transition-colors duration-300 hover:text-blue-200"
        >
          ← Knowledge Centre
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${LEVEL_BADGE[module.level]}`}
          >
            {module.level}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {module.chapterCount} chapters · ~{module.estimatedMinutes} min
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {module.title}
        </h1>

        {/* Honest coming-soon state — no fabricated lesson content. */}
        <div className="liquid-glass glass-sheen mt-8 rounded-3xl p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300/90">
            Content coming soon
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            This module's lessons are being written and will appear here soon.
            Its structure — {module.chapterCount} chapters, about{" "}
            {module.estimatedMinutes} minutes of learning — is set; the chapter
            content isn't published yet.
          </p>
        </div>

        {/* Outline: the real chapter count, numbered, each marked coming
            soon. No titles or summaries are shown because none exist. */}
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Chapter outline
          </p>
          <ul className="mt-4 space-y-2.5">
            {chapters.map((n) => (
              <li
                key={n}
                className="liquid-glass flex items-center justify-between rounded-2xl px-5 py-4"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/20 bg-blue-400/5 text-xs font-semibold tabular-nums text-blue-200">
                    {n}
                  </span>
                  <span className="text-sm font-medium text-gray-300">
                    Chapter {n}
                  </span>
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Coming soon
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ModuleNotFound() {
  return (
    <section className="section-tint-a relative px-4 pb-24 pt-[calc(var(--nav-height)+3rem)] sm:px-6 lg:px-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
          Knowledge Centre
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Module not found
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          We couldn't find that module. It may have moved, or the link may be
          mistyped.
        </p>
        <Link
          to="/knowledge-centre"
          className="liquid-glass mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/15"
        >
          ← Back to Knowledge Centre
        </Link>
      </div>
    </section>
  );
}
