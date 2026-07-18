import { useState } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { IconExternalLink } from "./Icons";
import { useLatestNews } from "../hooks/useNews";
import type { NewsFeedItem } from "../types";

/**
 * The publisher's article image, hotlinked from their CDN.
 *
 * Loaded eagerly — deliberately NO loading="lazy". This section sits
 * far below the fold and its cards mount only after the news fetch
 * resolves; in that situation native lazy-loading never loaded images
 * that were already in the viewport when the user reached the section
 * by a jump rather than a scroll (e.g. the "Research" nav item links
 * to /#research), leaving every card image blank — the real bug this
 * replaces. An IntersectionObserver-based lazy variant was tried but
 * could not be verified to fire reliably in that jump case. Eager
 * loading is simple and always works, and the cost is modest: the
 * whole set is ~0.5 MB (≈13 images, most 10–60 KB), only fetched once
 * the cards exist, and browsers still prioritise on-screen images.
 *
 * Renders nothing when there's no URL or the image fails to load, so a
 * card with a missing or dead image reflows cleanly to the text-only
 * layout rather than showing a gap or a broken-image icon. Decorative
 * (alt=""): the adjacent headline is already the link's accessible name.
 */
function ArticleImage({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function SourceTag({ source }: { source: string }) {
  return (
    <span className="liquid-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
      {source}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ArticleDate({ item }: { item: NewsFeedItem }) {
  return (
    <p className="text-xs text-gray-300/80 tabular-nums">
      {formatDate(item.publishedAt)}
    </p>
  );
}

/**
 * How many headlines sit in the side list beside the lead card. Capped
 * so the 1/3-width side column stays close in height to the lead card
 * rather than stacking every fetched item into a column several screens
 * tall — which, via the grid's row sizing, used to drag the lead card's
 * height along with it. A homepage teaser wants a handful of headlines,
 * not the full feed.
 */
const SIDE_HEADLINES = 3;

export function Research() {
  const { data: news } = useLatestNews();
  const items = news?.items ?? [];
  // Newest item gets the large card — structural emphasis only, not
  // editorial curation. The next few fill the side list, reverse-chron.
  const [lead, ...rest] = items;
  const sideHeadlines = rest.slice(0, SIDE_HEADLINES);

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
          eyebrow="Latest Market News"
          title="Headlines moving Pakistan's markets."
          description="Live coverage from Business Recorder — the PSX, SECP, the State Bank, and the wider economy. Headlines link out to the publisher; AZEE does not author this news."
        />

        {items.length > 0 && (
          <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            {/* Lead story */}
            {lead && (
              <Reveal className="lg:col-span-2">
                <a
                  href={lead.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="liquid-glass-strong glass-sheen card-glow group flex h-full flex-col justify-between rounded-3xl p-8 sm:p-10"
                >
                  <div>
                    <ArticleImage
                      src={lead.imageUrl}
                      className="mb-6 aspect-[16/9] w-full rounded-2xl object-cover"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <SourceTag source={lead.source} />
                      <IconExternalLink className="h-4 w-4 text-white/50 transition-colors duration-500 group-hover:text-white" />
                    </div>
                    <h3 className="mt-5 max-w-xl text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-3xl">
                      {lead.title}
                    </h3>
                    {lead.summary && (
                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
                        {lead.summary}
                      </p>
                    )}
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <ArticleDate item={lead} />
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-all duration-500 group-hover:gap-3 group-hover:text-white">
                      Read at {lead.source} <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </a>
              </Reveal>
            )}

            {/* Headline list */}
            <div className="flex flex-col gap-5">
              {sideHeadlines.map((item, i) => (
                <Reveal key={item.title} delay={i * 100} className="flex-1">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="liquid-glass card-glow group flex h-full flex-col justify-between rounded-3xl p-6 hover:bg-white/[0.12]"
                  >
                    <div>
                      <ArticleImage
                        src={item.imageUrl}
                        className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <SourceTag source={item.source} />
                        <IconExternalLink className="h-3.5 w-3.5 text-white/40 transition-colors duration-500 group-hover:text-white" />
                      </div>
                      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-white">
                        {item.title}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <ArticleDate item={item} />
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
        )}
      </div>
    </section>
  );
}
