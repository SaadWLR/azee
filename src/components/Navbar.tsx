import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FadeIn } from "./FadeIn";
import azeeLogo from "../assets/azee-logo.png";
import azeeLogoDark from "../assets/azee-logo-dark.png";

/**
 * The real AZEE Securities mark, in both of its lettering variants.
 *
 * The bar sits over three different grounds, and one mark cannot serve
 * them all: the supplied artwork is white-lettering on transparent, so
 * on the bone #trading surface its "Securities" line all but
 * disappeared. That used to be papered over with an ink chip behind
 * the logo — a dark ground carried along so a mark drawn for dark
 * would still read. With the dark-lettering variant on hand the chip
 * is gone and each surface simply gets the artwork drawn for it.
 *
 * BOTH ARE RENDERED, and CSS decides which is visible — rather than
 * swapping `src` off React state. The nav already crossfades its whole
 * palette over 0.45s; a src swap would pop the logo mid-fade, half a
 * second out of step with the bar around it. Stacked and cross-faded,
 * the mark changes with everything else. See .nav-mark in index.css.
 *
 * Rendered at h-9 (36px) — the rhythm the former two-line text lockup
 * set — and crisp at 3× DPR from both sources (needs 108px tall; they
 * are 123px and 240px). w-auto keeps each one's own aspect: 2.57:1 for
 * the white mark, 2.38:1 for the dark one, both tightly cropped, so
 * they read at the same optical size. Intrinsic width/height reserve
 * space to avoid layout shift.
 *
 * Only the in-flow mark carries the alt text; the overlay is the same
 * company name a second time, so it is hidden from assistive tech
 * rather than announced twice.
 */
function BrandMark() {
  return (
    <>
      <img
        src={azeeLogo}
        alt="AZEE Securities"
        width={316}
        height={123}
        className="nav-mark nav-mark-on-dark h-9 w-auto"
      />
      <img
        src={azeeLogoDark}
        alt=""
        aria-hidden="true"
        width={571}
        height={240}
        className="nav-mark nav-mark-on-light h-9 w-auto"
      />
    </>
  );
}

/**
 * Top-level plain links — the three entries after the dropdown groups
 * (NAV_GROUPS, below). A `hash` entry is a homepage section anchor
 * (a hash target on "/"); an entry with `to` is a real route link.
 *
 * "Forex & Commodities" took the slot "Products" used to hold — the bar
 * has a hard width budget at 1024px, and it earns a top-level place as
 * a standalone page in a way an on-page section does not. The Products
 * SECTION is untouched and still renders on the homepage; it simply
 * lost its direct shortcut, and is still reached by scrolling or via
 * the "Every market, one relationship." section itself.
 *
 * "Markets" (#markets, the hero) and "Research" (#research) were hash
 * links here too, until Sep 2026, when dropdowns of the same group names
 * took their positions. They went the way Products did: both SECTIONS
 * are untouched and still render on the homepage — reached by scrolling,
 * and /#research still lands on its section — they lost only the bar's
 * direct shortcut.
 */
type NavLink =
  | { label: string; hash: string; to?: undefined }
  | { label: string; to: string; hash?: undefined };

const NAV_LINKS: NavLink[] = [
  { label: "Trading", hash: "#trading" },
  // Named for what the page holds: currency rates AND a local gold
  // estimate. Route stays /forex.
  { label: "Forex & Commodities", to: "/forex" },
  { label: "About", hash: "#about" },
];

/**
 * The site's standalone pages, as three top-level dropdowns — Markets,
 * Corporate & Events, Research & News — ahead of the plain links.
 *
 * WHY TOP-LEVEL. From Aug to Sep 2026 these groups sat inside a single
 * "Tools" dropdown, deliberately NOT as separate top-level triggers: at
 * ten items one flat list would have been long, and the desktop bar's
 * 1024px width budget was treated as the scarcer resource, so grouping
 * inside the one existing panel bought clarity without spending a slot.
 * That was reversed in Sep 2026, because neither reason still held:
 *  - Slots. The groups took the positions of two hash links, "Markets"
 *    and "Research", that only scrolled the homepage, plus Tools' own —
 *    so the bar still holds six entries, and the three it gained each
 *    open onto real pages instead.
 *  - Width. Measured with all three triggers in place, not assumed from
 *    the unchanged count, the bar still fits on one line at 1024px;
 *    the figures are in NavDropdown's comment.
 *  - Length. The grouping survives intact: each group is its own panel
 *    of at most five links, so no list got long. What went is the extra
 *    step — a generic "Tools" label to open, then two other groups to
 *    read past — in front of every one of these pages.
 *
 * TOOLS CAN COME BACK. Removing it reflects the current page set, not a
 * rule: once a page belongs in none of these three groups, a "Tools"
 * trigger (or a fourth group) is where it goes — re-measuring the 1024px
 * bar first, since each trigger is heavier than a plain link.
 *
 * "Markets" is the instruments: live-price tooling, plus Mutual Funds.
 * "Corporate & Events" is what companies file and hold, and the macro
 * backdrop they report into. "Research & News" is investor education
 * and market sentiment. The same groups render on mobile, so the two
 * surfaces describe the site identically — this array is the only
 * definition of either, so a change here moves both.
 *
 * LABELS MATCH THE FOOTER'S WORDING ("PSX Indices", "PMEX Commodities",
 * "Company Announcements", "Corporate Calendar", "Mutual Funds",
 * "Knowledge Centre"), so a page carries one name across both navs.
 * This replaced shorter Tools-only labels ("Indices", "Commodity
 * Futures", "Announcements", "Calendar") in Sep 2026. "PMEX
 * Commodities" still keeps its page distinct from the top-level "Forex
 * & Commodities": one is PMEX futures contracts, the other spot
 * currency rates and a gold estimate.
 *
 * Mutual Funds is linked while its page is still an honest placeholder
 * — it states plainly that no verified fund data is shown yet. That is
 * a deliberate difference from the Economic Dashboard's history: it was
 * in the first grouping (Aug 2026), then left UNLINKED (not removed)
 * while it was still a placeholder, giving its slot to the Fear and
 * Optimism Index, and returned once it carried live SBP EasyData
 * figures with honest stale/unavailable states.
 *
 * Knowledge Centre has two nav paths: the Research & News group, and its
 * own link in the footer's Research & News column. It was in Tools from
 * Jul 2026, left when the groups were first drawn (Aug 2026) so the
 * footer was its only path, and came back in Sep 2026 alongside the
 * Fear and Optimism Index as research reading.
 */
interface NavGroup {
  heading: string;
  links: { label: string; to: string }[];
}

const NAV_GROUPS: NavGroup[] =
  [
    {
      heading: "Markets",
      links: [
        { label: "Market Watch", to: "/market-watch" },
        { label: "PSX Indices", to: "/indices" },
        { label: "PMEX Commodities", to: "/commodities" },
        { label: "ETFs", to: "/etfs" },
        { label: "Mutual Funds", to: "/mutual-funds" },
      ],
    },
    {
      heading: "Corporate & Events",
      links: [
        { label: "Company Announcements", to: "/announcements" },
        { label: "Corporate Calendar", to: "/corporate-calendar" },
        { label: "Economic Dashboard", to: "/economic-dashboard" },
      ],
    },
    {
      heading: "Research & News",
      links: [
        { label: "Knowledge Centre", to: "/knowledge-centre" },
        { label: "Fear and Optimism Index", to: "/fear-and-optimism-index" },
      ],
    },
  ];

/** A stable slug for a group — the mobile menu's view key. */
function groupSlug(group: NavGroup): string {
  return group.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * One desktop top-level dropdown: a group's trigger and its panel of
 * links. Rendered once per NAV_GROUPS entry. It is the former "Tools"
 * dropdown generalised to take a group, not a second mechanism — the
 * open/close behaviour below is the one Tools already had.
 *
 * Click-to-open (robust on touch/hybrid devices, unlike hover-only),
 * closing on: the trigger again, an outside click (which includes
 * opening a sibling dropdown, so only one is ever open), Escape (which
 * returns focus to the trigger), a route change, or picking a link. The
 * trigger wears the same link treatment and shows the active underline
 * when the current route is one of its links. The panel reuses the
 * nav-glass surface so it reads as one nav.
 *
 * WIDTH BUDGET, measured when the groups went top-level (Sep 2026) at
 * the 1024px breakpoint where this bar first appears: the six entries
 * take 722px of the 976px bar, leaving 104px between the brand and the
 * first trigger — down from 283px with one Tools trigger and five plain
 * links. No label wraps and the bar stays one line. That 104px is the
 * headroom a future top-level entry has to fit inside, so measure again
 * rather than assuming a seventh entry fits.
 *
 * The panel carries no group heading of its own: the trigger directly
 * above it already names the group. It opens left-aligned under its
 * trigger — the triggers now lead the bar, so a right-aligned panel
 * (right for Tools, the last item) would hang back over the brand.
 */
function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const active = group.links.some((link) => link.to === pathname);

  // Close on outside click and Escape while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Any navigation dismisses the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const underline =
    "after:absolute after:-bottom-1.5 after:left-1/2 after:h-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_12px_rgb(var(--azee-orange)/0.7)] after:transition-all after:duration-500";
  const triggerState = active
    ? // `is-active` is the semantic marker the link treatment already
      // uses, and index.css styles it for BUTTONS too — the trigger
      // once never set it, so on the light theme an active trigger
      // missed the full-contrast colour its own rule defines.
      "is-active text-white after:w-7"
    : open
      ? "text-white after:w-0"
      : "text-gray-300 after:w-0";

  return (
    <li ref={containerRef} className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`relative flex items-center gap-1 text-sm font-medium transition-colors duration-500 hover:text-white ${underline} ${triggerState}`}
      >
        {group.heading}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {/* w-60: the widest label, "Company Announcements", fits on one
          line; at w-56 it wrapped to two. */}
      <div
        role="menu"
        aria-label={group.heading}
        className={`nav-glass absolute left-0 top-[calc(100%+1.5rem)] w-60 rounded-2xl p-2 transition-all duration-300 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        {group.links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
            className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-300 ${
              pathname === link.to
                ? "bg-white/10 text-white"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </li>
  );
}

/**
 * The surfaces the nav knows how to sit over.
 *
 * "dark"  — the ink ground almost every section uses (the default).
 * "light" — an opted-in bone section (#trading).
 * "hero"  — the homepage hero. Its own theme rather than the shared
 *           dark one because the hero is not ink: it is footage rim-lit
 *           in --azee-blue over a navy floor, and a flat black bar
 *           floating on it reads as a foreign object rather than part
 *           of the same picture.
 *
 * Ordered by precedence — if the bar overlaps more than one opted-in
 * section at once, the earlier entry wins. Light outranks hero because
 * a light surface is the one case where the wrong choice costs
 * legibility rather than just cohesion.
 */
const THEME_PRECEDENCE = ["light", "hero"] as const;
type NavTheme = "dark" | (typeof THEME_PRECEDENCE)[number];

/** Shared row treatment for every tappable line in the mobile menu. */
const MOBILE_ROW =
  "block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white";

/**
 * Mobile dropdown: the three groups as drill-downs, then the plain nav
 * links — the same six entries, in the same order, as the desktop bar.
 *
 * Drill-downs, not one list. The old single Tools group used to expand
 * INLINE here — all its links plus their headings rendered beneath the
 * nav links, in a container with no height bound at all. On a phone
 * that ran past the bottom of the screen with nothing to scroll, so the
 * last entries were simply unreachable. So it became a drill-down: one
 * row that swaps in its own view with a back action.
 *
 * Each group now gets that treatment (Sep 2026): the top level shows
 * six rows (three group rows + three links), and tapping a group swaps
 * in a view holding only that group's links. It is the same mechanism
 * Tools had, keyed by group rather than duplicated.
 *
 * Every row uses the full 44px MOBILE_ROW again. While all ten links
 * shared one Tools view they were cut to 38px to fit an iPhone 14
 * without scrolling; a single group's view holds at most five, so that
 * trade-off no longer buys anything and was dropped.
 *
 * The scroll bound is kept as well, deliberately, even though the
 * drill-down alone makes today's menu short enough. The bug was not
 * "the list got long", it was "nothing stopped it getting long"; a
 * height cap is what turns a future overflow into a scroll instead of
 * a silent truncation.
 */
function MobileMenu({
  open,
  onHome,
  onNavigate,
}: {
  open: boolean;
  onHome: boolean;
  onNavigate: () => void;
}) {
  /** "main", or the slug of the group whose drill-down is showing. */
  const [view, setView] = useState("main");
  const drilled = NAV_GROUPS.find((group) => groupSlug(group) === view);

  /*
   * Reopening always starts at the top level. Reset on close rather
   * than on open so it happens behind the closing fade, never as a
   * visible flip while the panel is still on screen.
   */
  useEffect(() => {
    if (!open) setView("main");
  }, [open]);

  return (
    <div
      id="mobile-menu"
      aria-label="Site menu"
      className={`nav-glass mx-auto mt-2 max-w-6xl rounded-3xl p-5 transition-all duration-500 ease-out lg:hidden ${
        open
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      {/*
       * The scroll bound. dvh (not vh) so mobile browser chrome
       * collapsing does not leave the menu taller than the visible
       * viewport; --nav-height is the bar above it and the remaining
       * 3.75rem cover this panel's own margin (0.5) and padding (2.5)
       * plus a 0.75rem gap above the screen edge. It was 7rem while a
       * Client Login button was pinned below this area (Sep 2026: that
       * button, 3.25rem with its margin, was removed) — keeping the old
       * figure would have reserved space for nothing and made the list
       * scroll sooner than it has to.
       */}
      <div className="max-h-[calc(100dvh-var(--nav-height)-3.75rem)] overflow-y-auto overscroll-contain">
        {!drilled ? (
          <ul data-menu-view="main" className="nav-drill-back">
            {/* One row per group, standing in for its whole link set. */}
            {NAV_GROUPS.map((group) => (
              <li key={group.heading} className="border-b border-white/10">
                <button
                  type="button"
                  aria-expanded={false}
                  onClick={() => setView(groupSlug(group))}
                  className={`${MOBILE_ROW} flex w-full items-center justify-between`}
                >
                  {group.heading}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M4.5 3 7.5 6 4.5 9" />
                  </svg>
                </button>
              </li>
            ))}
            {NAV_LINKS.map((link) => (
              <li key={link.label} className="border-b border-white/10">
                {link.to ? (
                  // Real route: always a router link, regardless of page.
                  <Link to={link.to} onClick={onNavigate} className={MOBILE_ROW}>
                    {link.label}
                  </Link>
                ) : onHome ? (
                  // Same-page anchor: native browser scroll, untouched.
                  <a href={link.hash} onClick={onNavigate} className={MOBILE_ROW}>
                    {link.label}
                  </a>
                ) : (
                  // Cross-route: client-side navigation; ScrollToHash in
                  // the root layout scrolls to the section once home
                  // renders.
                  <Link
                    to={`/${link.hash}`}
                    onClick={onNavigate}
                    className={MOBILE_ROW}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div data-menu-view={view} className="nav-drill-forward">
            {/* Back first, and full-width: on a phone the top-left of
                the panel is where a back control is looked for, and a
                wide target is easier to hit than a bare chevron. */}
            <button
              type="button"
              onClick={() => setView("main")}
              className={`${MOBILE_ROW} flex w-full items-center gap-2 border-b border-white/10 text-gray-400`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M7.5 3 4.5 6 7.5 9" />
              </svg>
              Back
            </button>
            <ul>
              {/* The view names its group: unlike desktop, where the
                  trigger stays in sight above the panel, the tapped row
                  has just been swapped away. */}
              <li className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600">
                {drilled.heading}
              </li>
              {drilled.links.map((link) => (
                <li key={link.to} className="border-b border-white/10">
                  <Link to={link.to} onClick={onNavigate} className={MOBILE_ROW}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /** Which surface the nav is currently sitting over. */
  const [navTheme, setNavTheme] = useState<NavTheme>("dark");
  const [active, setActive] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Section anchors point at in-page hashes on the homepage, and at
  // the homepage-plus-hash from any other route so they still work.
  const pathname = useLocation().pathname;
  const onHome = pathname === "/";

  /*
   * Publish the fixed bar's bottom edge as --nav-height so the ticker
   * and hero offset themselves without hard-coded values. The nav
   * element (not the header) is measured, so the open mobile menu
   * doesn't push the rest of the page down. offsetTop/offsetHeight
   * are used instead of getBoundingClientRect so the entrance
   * transform of the FadeIn wrapper doesn't skew the measurement;
   * offsets are summed up to the fixed header, which sits at top 0.
   */
  useLayoutEffect(() => {
    const header = headerRef.current;
    const nav = navRef.current;
    if (!header || !nav) return;
    const update = () => {
      let bottom = nav.offsetHeight;
      let el: HTMLElement | null = nav;
      while (el && el !== header) {
        bottom += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      document.documentElement.style.setProperty(
        "--nav-height",
        `${bottom}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  /*
   * SECTION-AWARE THEME.
   *
   * The nav is opaque and fixed, so whatever section it happens to be
   * covering decides how it should look. A section opts in by naming a
   * theme in data-nav-theme-section — "light" for the bone #trading
   * block, "hero" for the homepage hero. Any future section gets a
   * treatment by adding that attribute plus a CSS block for its value;
   * this effect only needs the new value added to THEME_PRECEDENCE.
   *
   * Measured against the nav's own band (its real top and bottom edges)
   * rather than a fixed scroll offset, so it stays correct as the bar's
   * height changes across breakpoints and when the mobile menu opens.
   *
   * A plain rAF-throttled scroll listener rather than an
   * IntersectionObserver: what matters is whether a band overlaps the
   * nav right now, which is a direct rect comparison — an observer
   * would need a rootMargin recalculated from the nav's live height to
   * express the same thing.
   */
  useEffect(() => {
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const nav = navRef.current;
      if (!nav) return;
      const bar = nav.getBoundingClientRect();

      // Highest-precedence theme whose section the bar currently
      // overlaps, falling back to the ink default.
      let next: NavTheme = "dark";
      for (const theme of THEME_PRECEDENCE) {
        const sections = document.querySelectorAll(
          `[data-nav-theme-section="${theme}"]`,
        );
        let found = false;
        for (const section of sections) {
          const rect = section.getBoundingClientRect();
          // Overlap test against the bar's band, not just its midpoint —
          // a partial overlap should already flip it.
          if (rect.top < bar.bottom && rect.bottom > bar.top) {
            found = true;
            break;
          }
        }
        if (found) {
          next = theme;
          break;
        }
      }
      setNavTheme(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // Re-evaluated on route change: a different page has different
    // sections, and the old page's rects are gone.
  }, [pathname]);

  /* Soft drop shadow once the page is scrolled. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Scroll spy: highlight the section currently in view. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // Only the hash entries have a section to spy on; a route entry
    // (Forex) has no homepage element and is skipped.
    const targets = NAV_LINKS.filter((link) => link.hash !== undefined)
      .map((link) => document.getElementById(link.hash!.slice(1)))
      .filter((el): el is HTMLElement => el !== null);
    /*
     * Track which spied sections are in the band, and clear the
     * highlight when none is. It used to only ever set, never clear —
     * harmless while the hero (#markets) and #research were spied too,
     * because some entry always took over. Once those two links left
     * the bar (Sep 2026), scrolling back up to the hero left "About"
     * underlined over it, and "Trading" stayed lit over Research
     * (measured). Now an entry is lit only while its own section is.
     */
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const [current] = inBand;
        setActive(current ? `#${current}` : "");
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      /*
       * pointer-events-none on the fixed header container is essential:
       * below lg the closed MobileMenu still sits in the flow (just
       * opacity-0), which inflates this fixed box to ~620px tall. With
       * pointer-events auto it would intercept every tap/swipe in the
       * top ~620px of the page — blocking the filter pills, the top of
       * the Market Watch / Corporate Calendar tables, and homepage CTAs
       * on tablet/phone. The interactive children (the nav, and the
       * MobileMenu when open) re-enable pointer events on themselves.
       */
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5"
    >
      <FadeIn delay={100}>
        <nav
          ref={navRef}
          data-nav-theme={navTheme}
          className={`nav-glass pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-2.5 sm:px-7 ${
            scrolled ? "nav-glass-scrolled" : ""
          }`}
        >
          {/* Identity — scrolls to top on the homepage, returns home
              from any other route. */}
          {onHome ? (
            /*
             * On the homepage the mark scrolls to top — an action, not a
             * navigation, so it is a button. It was an href="#", which
             * did the same thing but read as a dead link in every audit
             * of this file; a button states the intent and leaves no
             * placeholder href behind.
             */
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="nav-brand shrink-0"
              aria-label="AZEE Securities — back to top"
            >
              <BrandMark />
            </button>
          ) : (
            <Link to="/" className="nav-brand shrink-0" aria-label="AZEE Securities — home">
              <BrandMark />
            </Link>
          )}

          <ul className="nav-themed hidden items-center gap-7 lg:flex">
            {/* The three groups lead the bar as dropdowns, then the
                plain links. There is no "Tools" trigger any more — see
                NAV_GROUPS for why, and for when one would come back. */}
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.heading} group={group} pathname={pathname} />
            ))}
            {NAV_LINKS.map((link) => {
              // A route entry is "active" on its own route; a hash
              // entry is active when scroll-spy has it in view.
              const isActive = link.to
                ? pathname === link.to
                : active === link.hash;
              const linkClass = `relative text-sm font-medium transition-colors duration-500 after:absolute after:-bottom-1.5 after:left-1/2 after:h-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_12px_rgb(var(--azee-orange)/0.7)] after:transition-all after:duration-500 hover:text-white ${
                isActive ? "is-active text-white after:w-7" : "text-gray-300 after:w-0"
              }`;
              return (
                <li key={link.label} className="flex items-center">
                  {link.to ? (
                    // Real route: always a router link.
                    <Link to={link.to} className={linkClass}>
                      {link.label}
                    </Link>
                  ) : onHome ? (
                    // Same-page anchor: native browser scroll, untouched.
                    <a href={link.hash} className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    // Cross-route: client-side navigation; ScrollToHash
                    // in the root layout scrolls once home renders.
                    <Link to={`/${link.hash}`} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="nav-toggle flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 hover:bg-white/10 active:scale-[0.95] lg:hidden"
          >
            <span
              className={`h-px w-4 bg-white transition-transform duration-500 ${
                menuOpen ? "translate-y-[3px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-px w-4 bg-white transition-transform duration-500 ${
                menuOpen ? "-translate-y-[3px] -rotate-45" : ""
              }`}
            />
          </button>
        </nav>
      </FadeIn>

      <MobileMenu
        open={menuOpen}
        onHome={onHome}
        onNavigate={() => setMenuOpen(false)}
      />
    </header>
  );
}
