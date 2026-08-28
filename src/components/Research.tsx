import { useState, type ReactNode } from "react";
import { Reveal } from "./Reveal";
import { IconExternalLink } from "./Icons";
import { useLatestNews } from "../hooks/useNews";
import type { NewsFeedItem } from "../types";

/**
 * #research — News & Insights.
 *
 * ONE FOCAL POINT: the real headlines. The publishers' own article
 * images are the section's visual, exactly as before — what changed is
 * the presentation around them: flat ink ground instead of a patterned
 * backdrop, outline-only cards at a large radius instead of filled
 * glass tiles, and a serif display headline.
 *
 * BUILT FOR A BLOG THAT DOES NOT EXIST YET. The section is a channel
 * switcher driven by the CHANNELS registry below. "News" is live and
 * reads the real feed; "Blog" is present, visibly marked as not yet
 * published, and says plainly that nothing has been written rather
 * than showing invented posts.
 *
 * Adding the blog later is a data change, not a rework: give the blog
 * channel a `status: "live"` and a renderer. The tab strip, the
 * selection state, the empty/pending panel, the URL-free local state
 * and the layout all already handle an arbitrary number of channels —
 * nothing in this file assumes there is exactly one live channel.
 */

type ChannelStatus = "live" | "pending";

interface Channel {
  id: string;
  label: string;
  status: ChannelStatus;
  /** Shown under the tabs when this channel is selected. */
  blurb: string;
  /** Shown in place of content while the channel is `pending`. */
  pendingNote?: string;
}

const CHANNELS: Channel[] = [
  {
    id: "news",
    label: "Market News",
    status: "live",
    blurb:
      "Live coverage from Business Recorder and The Express Tribune — the PSX, SECP, the State Bank and the wider economy. Headlines link out to the publisher; AZEE does not author this news.",
  },
  {
    id: "blog",
    label: "AZEE Blog",
    status: "pending",
    blurb:
      "Written commentary from our own research desk — market notes, sector views and explainers.",
    pendingNote:
      "Nothing has been published yet. When our desk starts writing, posts will appear here rather than anywhere else on the site.",
  },
];

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
 * loading is simple and always works, and the cost is modest: most
 * images are 10–60 KB, and the collapsed grid only mounts the visible
 * cards, so the extra "See more" images aren't fetched until revealed.
 *
 * Renders nothing when there's no URL or the image fails to load, so a
 * card with a missing or dead image reflows cleanly to the text-only
 * layout rather than showing a gap or a broken-image icon. Decorative
 * (alt=""): the adjacent headline is already the link's accessible name.
 */
function ArticleImage({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt="" onError={() => setFailed(true)} className={className} />;
}

function SourceTag({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgb(var(--azee-navy)/0.16)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--azee-navy)/0.65)]">
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
    <p className="text-xs tabular-nums text-[rgb(var(--azee-navy)/0.62)]">
      {formatDate(item.publishedAt)}
    </p>
  );
}

/** Outline-only headline card, large radius, no fill and no shadow. */
function HeadlineCard({
  item,
  delay = 0,
  wrapperClassName,
}: {
  item: NewsFeedItem;
  delay?: number;
  wrapperClassName: string;
}) {
  return (
    <Reveal delay={delay} className={wrapperClassName}>
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col justify-between rounded-[28px] border border-[rgb(var(--azee-navy)/0.14)] p-6 transition-colors duration-300 hover:border-[rgb(var(--azee-navy)/0.6)]"
      >
        <div>
          <ArticleImage
            src={item.imageUrl}
            className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover"
          />
          <div className="flex items-center justify-between gap-3">
            <SourceTag source={item.source} />
            <IconExternalLink className="h-3.5 w-3.5 text-[rgb(var(--azee-navy)/0.62)] transition-colors duration-300 group-hover:text-[rgb(var(--azee-navy))]" />
          </div>
          <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight text-[rgb(var(--azee-navy))]">
            {item.title}
          </h3>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <ArticleDate item={item} />
          <span
            aria-hidden="true"
            className="text-[rgb(var(--azee-navy)/0.62)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[rgb(var(--azee-navy))]"
          >
            →
          </span>
        </div>
      </a>
    </Reveal>
  );
}

/**
 * Beside the lead card sit exactly this many headlines, kept at 2 so
 * the 1/3-width side column stays close in height to the lead card.
 */
const SIDE_HEADLINES = 2;

/**
 * How many grid cards show before "See more" — one full desktop row
 * (the grid is 3 columns at lg). With the lead + 2 side cards that's
 * 6 stories visible by default; the rest of whatever the feed returned
 * are one click away, no extra request.
 */
const GRID_HEADLINES_DEFAULT = 3;

/** The live news channel: the real feed, in its established layout. */
function NewsChannel() {
  const { data: news, loading } = useLatestNews();
  const [expanded, setExpanded] = useState(false);
  const items = news?.items ?? [];
  const [lead, ...rest] = items;
  const sideHeadlines = rest.slice(0, SIDE_HEADLINES);
  const gridHeadlines = rest.slice(SIDE_HEADLINES);
  const visibleGrid = expanded
    ? gridHeadlines
    : gridHeadlines.slice(0, GRID_HEADLINES_DEFAULT);
  const hiddenCount = gridHeadlines.length - GRID_HEADLINES_DEFAULT;

  /*
   * Nothing to say yet on the very first load — the section's heading,
   * tabs and standfirst are already up, and a flash of "unavailable"
   * before the feed has had a chance to answer would be a lie.
   */
  if (loading) return null;

  /*
   * No headlines to show. Say so, rather than rendering the heading,
   * the tabs and the standfirst above an empty void — the bug this
   * replaces, where an outage was indistinguishable from a layout
   * failure. Mirrors how the rest of the site reports an outage (see
   * MarketPulseGauge): name what did not respond, promise nothing, and
   * never substitute placeholder or invented articles.
   *
   * Keyed on "are there items", NOT on the hook's `error`: a failed
   * BACKGROUND poll sets `error` while useAsyncData deliberately keeps
   * the last good headlines, and those are real, attributed articles
   * that should stay on screen. What matters is whether we have
   * anything true to show, not whether the most recent fetch failed.
   */
  if (items.length === 0) return <UnavailableChannel />;

  return (
    <>
      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {lead && (
          <Reveal className="lg:col-span-2">
            <a
              href={lead.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col justify-between rounded-[28px] border border-[rgb(var(--azee-navy)/0.14)] p-8 transition-colors duration-300 hover:border-[rgb(var(--azee-navy)/0.6)] sm:p-10"
            >
              <div>
                <ArticleImage
                  src={lead.imageUrl}
                  className="mb-7 aspect-[16/9] w-full rounded-2xl object-cover"
                />
                <div className="flex items-center justify-between gap-3">
                  <SourceTag source={lead.source} />
                  <IconExternalLink className="h-4 w-4 text-[rgb(var(--azee-navy)/0.62)] transition-colors duration-300 group-hover:text-[rgb(var(--azee-navy))]" />
                </div>
                <h3 className="mt-5 max-w-xl text-2xl font-bold leading-[1.15] tracking-tight text-[rgb(var(--azee-navy))] sm:text-3xl">
                  {lead.title}
                </h3>
                {lead.summary && (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-[rgb(var(--azee-navy)/0.68)] sm:text-base">
                    {lead.summary}
                  </p>
                )}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <ArticleDate item={lead} />
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[rgb(var(--azee-navy)/0.75)] transition-all duration-300 group-hover:gap-3 group-hover:text-[rgb(var(--azee-navy))]">
                  Read at {lead.source} <span aria-hidden="true">→</span>
                </span>
              </div>
            </a>
          </Reveal>
        )}

        <div className="flex flex-col gap-5">
          {sideHeadlines.map((item, i) => (
            <HeadlineCard
              key={item.title}
              item={item}
              delay={i * 100}
              wrapperClassName="flex-1"
            />
          ))}
        </div>
      </div>

      {visibleGrid.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGrid.map((item, i) => (
            <HeadlineCard
              key={item.title}
              item={item}
              delay={(i % 3) * 100}
              wrapperClassName="h-full"
            />
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="rounded-full border border-[rgb(var(--azee-navy)/0.22)] px-7 py-3 text-sm font-semibold text-[rgb(var(--azee-navy))] transition-colors duration-300 hover:border-[rgb(var(--azee-navy)/0.62)]"
          >
            {expanded ? "Show fewer" : `See more headlines (${hiddenCount})`}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * The section's one empty-state panel: a label and a plain explanation,
 * in the same outline-card language as the headline cards.
 *
 * Deliberately carries NO outbound link. The two states that use it
 * (nothing written yet, feed unreachable) both mean "there is nothing
 * true to show here"; a link would render as `#research a[href]` and
 * read — to a person skimming and to the specs alike — as an article
 * card, which is the exact confusion this panel exists to remove.
 */
function ChannelNotice({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-14 rounded-[28px] border border-[rgb(var(--azee-navy)/0.14)] px-8 py-20 text-center sm:px-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--azee-navy)/0.62)]">
        {label}
      </p>
      <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-[rgb(var(--azee-navy)/0.6)]">
        {children}
      </p>
    </div>
  );
}

/** Honest empty state for a channel that has no content yet. */
function PendingChannel({ channel }: { channel: Channel }) {
  return (
    <ChannelNotice label="Not yet published">{channel.pendingNote}</ChannelNotice>
  );
}

/**
 * Honest outage state for the live news channel.
 *
 * Names the publishers, because the failure is theirs to us, not ours
 * to the reader — and says the headlines are coming back rather than
 * implying the section is empty by design (which is what the pending
 * blog panel means, and the two must not read alike).
 */
function UnavailableChannel() {
  return (
    <ChannelNotice label="Headlines unavailable">
      Live headlines are unavailable right now — the Business Recorder and
      Express Tribune feeds did not respond. Nothing is shown in their place:
      AZEE does not author this news. The headlines return on their own once
      the publishers are reachable again.
    </ChannelNotice>
  );
}

export function Research() {
  const [activeId, setActiveId] = useState(CHANNELS[0].id);
  const active = CHANNELS.find((c) => c.id === activeId) ?? CHANNELS[0];

  return (
    <section
      id="research"
      /* White ground — the opaque nav needs its light treatment here. */
      data-nav-theme-section="light"
      className="relative bg-[rgb(var(--azee-paper))] py-28 lg:py-40"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[rgb(var(--azee-navy)/0.12)]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow">News &amp; Insights</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display mt-8 text-[2.75rem] text-[rgb(var(--azee-navy))] sm:text-6xl lg:text-7xl">
              Headlines moving
              <br />
              Pakistan&apos;s markets.
            </h2>
          </Reveal>

          {/* Channel switcher — pill tabs, the section's only control. */}
          <Reveal delay={200}>
            <div
              role="tablist"
              aria-label="News and insights channels"
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--azee-navy)/0.14)] p-1.5"
            >
              {CHANNELS.map((channel) => {
                const selected = channel.id === active.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveId(channel.id)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-300 ${
                      selected
                        ? "bg-[rgb(var(--azee-navy))] text-[rgb(var(--azee-paper))]"
                        : "text-[rgb(var(--azee-navy)/0.6)] hover:text-[rgb(var(--azee-navy))]"
                    }`}
                  >
                    {channel.label}
                    {channel.status === "pending" && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--azee-navy)/0.62)]">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={250}>
            <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed text-[rgb(var(--azee-navy)/0.68)]">
              {active.blurb}
            </p>
          </Reveal>
        </div>

        {active.status === "live" && active.id === "news" ? (
          <NewsChannel />
        ) : (
          <PendingChannel channel={active} />
        )}
      </div>
    </section>
  );
}
