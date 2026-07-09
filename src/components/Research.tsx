import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { useResearchReports } from "../hooks/useResearch";
import type { ResearchCategory, ResearchReport } from "../types";

function CategoryTag({ category }: { category: ResearchCategory }) {
  return (
    <span className="liquid-glass inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
      {category}
    </span>
  );
}

function ArticleMeta({ article }: { article: ResearchReport }) {
  return (
    <p className="text-xs text-gray-300/80 tabular-nums">
      {article.date} · {article.readMinutes} min read
    </p>
  );
}

export function Research() {
  const { data: reports } = useResearchReports();
  const featured = reports?.find((report) => report.featured);
  const rest = reports?.filter((report) => !report.featured) ?? [];

  return (
    <section id="research" className="relative overflow-hidden py-24 lg:py-32">
      {/* Faint terminal grid behind the section */}
      <div aria-hidden="true" className="bg-grid absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <SectionHeading
          eyebrow="Research & Market Intelligence"
          title="Analysis written for decisions, not headlines."
          description="Our research desk covers the KSE-100 and beyond — weekly strategy, company fundamentals, sector deep-dives, and the daily tape."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Featured report */}
          {featured && (
            <Reveal className="lg:col-span-2">
            <a
              href="#"
              className="liquid-glass-strong glass-sheen card-glow group flex h-full flex-col justify-between rounded-3xl p-8 sm:p-10"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <CategoryTag category={featured.category} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300/90">
                    Featured Research
                  </span>
                </div>
                <h3 className="mt-5 max-w-xl text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-3xl">
                  {featured.title}
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <ArticleMeta article={featured} />
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-all duration-500 group-hover:gap-3 group-hover:text-white">
                  Read the outlook <span aria-hidden="true">→</span>
                </span>
              </div>
            </a>
            </Reveal>
          )}

          {/* Report list */}
          <div className="flex flex-col gap-5">
            {rest.map((article, i) => (
              <Reveal key={article.title} delay={i * 100} className="flex-1">
                <a
                  href="#"
                  className="liquid-glass card-glow group flex h-full flex-col justify-between rounded-3xl p-6 hover:bg-white/[0.12]"
                >
                  <div>
                    <CategoryTag category={article.category} />
                    <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-white">
                      {article.title}
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <ArticleMeta article={article} />
                    <span
                      aria-hidden="true"
                      className="text-white/60 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white"
                    >
                      →
                    </span>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
