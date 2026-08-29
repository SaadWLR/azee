import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { getLegalPage } from "../data/legal";
import type { LegalBlock } from "../types/legal";

/*
 * One component for every legal / compliance page, driven by the
 * registry in src/data/legal.ts — the same "one typed array, not N
 * components" approach as the Knowledge Centre modules.
 *
 * A page either carries approved `blocks` or an honest `pending`
 * state. There is deliberately no third mode: nothing on these pages
 * is generated, summarized or paraphrased at render time.
 */

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h2 className="mt-9 text-lg font-semibold tracking-tight text-white first:mt-0">
          {block.text}
        </h2>
      );
    case "paragraph":
      return (
        <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul className="mt-4 space-y-2.5">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm leading-relaxed text-gray-300/90"
            >
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "definitions":
      return (
        <dl className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
          {block.items.map((item) => (
            <div
              key={item.term}
              className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6"
            >
              <dt className="text-sm font-semibold text-gray-300 sm:w-64 sm:shrink-0">
                {item.term}
              </dt>
              <dd className="text-sm text-white/90">
                {/^https?:\/\//.test(item.value) ? (
                  <a
                    href={item.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
                  >
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "downloads":
      return (
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {block.items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-glass group flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm text-white/90 transition-all duration-300 hover:bg-white/10 hover:text-white"
              >
                <span
                  aria-hidden="true"
                  className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/80"
                >
                  PDF
                </span>
                <span className="flex-1">{item.label}</span>
                <span
                  aria-hidden="true"
                  className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  ↓
                </span>
              </a>
            </li>
          ))}
        </ul>
      );
  }
}

export function LegalPage({ slug }: { slug: string }) {
  const page = getLegalPage(slug);

  usePageMeta(
    page ? `${page.title} | AZEE Trade` : "AZEE Trade",
    page?.description ?? "",
  );

  if (!page) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">
        Page not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            {page.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            {page.title}
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          {page.effectiveDate && (
            <p className="mt-4 text-xs text-gray-400 tabular-nums">
              Effective date: {page.effectiveDate}
            </p>
          )}

          <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
            {page.blocks ? (
              page.blocks.map((block, i) => (
                <Block key={`${block.kind}-${i}`} block={block} />
              ))
            ) : page.pending ? (
              <>
                {/*
                 * Honest outstanding-content state, matching the
                 * Knowledge Centre modules. The page says what it will
                 * contain and what is missing; it does not approximate
                 * the policy in the meantime.
                 */}
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
                  Content pending
                </p>
                <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
                  {page.pending.summary}
                </p>
                <p className="mt-6 text-sm font-semibold text-gray-300">
                  This page will be published once the following are
                  confirmed by our compliance department:
                </p>
                <ul className="mt-3 space-y-2.5">
                  {page.pending.needed.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-relaxed text-gray-300/90"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300/70"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-7 text-sm leading-relaxed text-gray-400">
                  We publish this information only once it is confirmed,
                  rather than posting an approximation. For anything you need
                  in the meantime, please contact our compliance department at{" "}
                  <a
                    href="mailto:info@azeetrade.com"
                    className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
                  >
                    info@azeetrade.com
                  </a>
                  .
                </p>
              </>
            ) : null}
          </div>

          {page.blocks && (
            <p className="mt-5 text-xs leading-relaxed text-gray-400/90">
              For any question about this page, contact our compliance
              department at{" "}
              <a
                href="mailto:info@azeetrade.com"
                className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
              >
                info@azeetrade.com
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
