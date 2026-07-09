import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { RESEARCH_ARTICLES, type ResearchArticle } from "../data/marketData";

function CategoryTag({ category }: { category: ResearchArticle["category"] }) {
  return (
    <span className="liquid-glass inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
      {category}
    </span>
  );
}

function ArticleMeta({ article }: { article: ResearchArticle }) {
  return (
    <p className="text-xs text-gray-300/80 tabular-nums">
      {article.date} · {article.readMinutes} min read
    </p>
  );
}

export function Research() {
  const featured = RESEARCH_ARTICLES.find((a) => a.featured)!;
  const rest = RESEARCH_ARTICLES.filter((a) => !a.featured);

  return (
    <section className="relative overflow-hidden bg-black py-24 lg:py-32">
      {/* Faint terminal grid behind the section */}
      <div aria-hidden="true" className="bg-grid absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <SectionHeading
          eyebrow="Research & Market Intelligence"
          title="Analysis written for decisions, not headlines."
          description="Our research desk covers the KSE-100 and beyond — weekly strategy, company fundamentals, sector deep-dives, and the daily tape."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Featured report */}
          <Reveal className="lg:col-span-2">
            <a
              href="#"
              className="liquid-glass-strong glass-sheen group flex h-full flex-col justify-between rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_64px_rgba(0,0,0,0.5)] sm:p-10"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <CategoryTag category={featured.category} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Featured Research
                  </span>
                </div>
                <h3 className="mt-5 max-w-xl text-2xl font-bold tracking-tight text-white transition-colors duration-300 sm:text-3xl">
                  {featured.title}
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <ArticleMeta article={featured} />
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-all duration-300 group-hover:gap-3 group-hover:text-white">
                  Read the outlook <span aria-hidden="true">→</span>
                </span>
              </div>
            </a>
          </Reveal>

          {/* Report list */}
          <div className="flex flex-col gap-5">
            {rest.map((article, i) => (
              <Reveal key={article.title} delay={i * 100} className="flex-1">
                <a
                  href="#"
                  className="liquid-glass group flex h-full flex-col justify-between rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.14]"
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
                      className="text-white/60 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
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
