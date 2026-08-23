import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FadeIn } from "./FadeIn";
import azeeLogo from "../assets/azee-logo.png";

/*
 * The real AZEE Securities mark (dark-background variant, transparent
 * PNG). Rendered at h-9 (36px) — proportional to the nav rhythm the
 * former two-line text lockup set, and crisp: the 316×123 source has
 * enough pixels for a 36px render even at 3× DPR (needs 108px tall).
 * w-auto keeps its 2.57:1 aspect; intrinsic width/height attrs reserve
 * space to avoid layout shift. Per the brand decision the logo stands
 * alone — the "PSX Trading & Research" tagline is dropped since the
 * mark already names the company.
 */
function BrandMark() {
  return (
    <img
      src={azeeLogo}
      alt="AZEE Securities"
      width={316}
      height={123}
      className="h-9 w-auto"
    />
  );
}

/**
 * Top-level nav. Most entries are homepage section anchors (hash
 * targets on "/"); an entry with `to` instead is a real route link.
 *
 * "Forex & Commodities" took the slot "Products" used to hold — the bar
 * has a hard width budget at 1024px, and it earns a top-level place as
 * a standalone page in a way an on-page section does not. The Products
 * SECTION is untouched and still renders on the homepage; it simply
 * lost its direct shortcut, and is still reached by scrolling or via
 * the "Every market, one relationship." section itself.
 */
type NavLink =
  | { label: string; hash: string; to?: undefined }
  | { label: string; to: string; hash?: undefined };

const NAV_LINKS: NavLink[] = [
  { label: "Markets", hash: "#markets" },
  { label: "Research", hash: "#research" },
  { label: "Trading", hash: "#trading" },
  // Named for what the page holds: currency rates AND a local gold
  // estimate. Route stays /forex.
  { label: "Forex & Commodities", to: "/forex" },
  { label: "About", hash: "#about" },
];

/**
 * Standalone tool/resource pages under the single "Tools" trigger,
 * organised into two labelled groups rather than one flat list.
 *
 * Two groups, one trigger — deliberately not two top-level dropdowns:
 * at seven items a flat list is merely long, not confusing, and the
 * desktop bar's 1024px width budget is the scarcer resource. Grouping
 * inside the existing panel buys the clarity without spending a slot.
 *
 * "Markets" is live-price tooling; "Research" is reference, disclosure
 * and macro. The same grouping renders on mobile, so the two surfaces
 * describe the site identically.
 *
 * "Commodity Futures" is named in full to disambiguate it from the
 * top-level "Forex & Commodities" — this one is PMEX futures
 * contracts, not spot. "Calendar" stays short for width; it goes to
 * the full Corporate Calendar page.
 *
 * Knowledge Centre is deliberately NOT here: it already has its own
 * link in the footer's Research & News column, which is now its single
 * nav path.
 */
const TOOL_GROUPS: { heading: string; links: { label: string; to: string }[] }[] =
  [
    {
      heading: "Markets",
      links: [
        { label: "Market Watch", to: "/market-watch" },
        { label: "Indices", to: "/indices" },
        { label: "Commodity Futures", to: "/commodities" },
        { label: "ETFs", to: "/etfs" },
      ],
    },
    {
      heading: "Research",
      links: [
        { label: "Announcements", to: "/announcements" },
        { label: "Calendar", to: "/corporate-calendar" },
        { label: "Economic Dashboard", to: "/economic-dashboard" },
      ],
    },
  ];

/** Flattened, for active-route detection and any list rendering. */
const TOOL_LINKS = TOOL_GROUPS.flatMap((g) => g.links);

/**
 * Desktop "Tools" dropdown. Click-to-open (robust on touch/hybrid
 * devices, unlike hover-only), closing on: the trigger again, an
 * outside click, Escape (which returns focus to the trigger), a route
 * change, or picking a link. The trigger wears the same link treatment
 * and shows the active underline when the current route is any of its
 * links. The panel reuses the nav-glass surface so it reads as one nav.
 */
function ToolsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const active = TOOL_LINKS.some((tool) => tool.to === pathname);

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
    "after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_10px_rgb(var(--azee-orange)/0.55)] after:transition-all after:duration-500";
  const triggerState = active
    ? "text-white after:w-6"
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
        Tools
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

      <div
        role="menu"
        aria-label="Tools"
        className={`nav-glass absolute right-0 top-[calc(100%+1.5rem)] w-56 rounded-2xl p-2 transition-all duration-300 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        {TOOL_GROUPS.map((group, i) => (
          <div
            key={group.heading}
            role="group"
            aria-label={group.heading}
            className={i > 0 ? "mt-1.5 border-t border-white/10 pt-1.5" : ""}
          >
            <p className="px-4 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              {group.heading}
            </p>
            {group.links.map((tool) => (
              <Link
                key={tool.to}
                to={tool.to}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  pathname === tool.to
                    ? "bg-white/10 text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tool.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </li>
  );
}

/** Shared row treatment for every tappable line in the mobile menu. */
const MOBILE_ROW =
  "block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white";

/**
 * Mobile dropdown: navigation links plus the client login action.
 *
 * Two views, not one list. Tools used to expand INLINE here — all seven
 * links plus their two group headings rendered beneath the five nav
 * links, in a container with no height bound at all. On a phone that
 * ran past the bottom of the screen with nothing to scroll, so the last
 * entries were simply unreachable.
 *
 * So Tools is now a drill-down: the top level shows six rows (five nav
 * links + one "Tools" row), and tapping it swaps in a Tools-only view
 * with a back action. Desktop is untouched — its dropdown has room to
 * show both groups at once and always did.
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
  const [view, setView] = useState<"main" | "tools">("main");

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
       * rem cover this panel's own margin, padding and the pinned
       * action below.
       */}
      <div className="max-h-[calc(100dvh-var(--nav-height)-7rem)] overflow-y-auto overscroll-contain">
        {view === "main" ? (
          <ul data-menu-view="main" className="nav-drill-back">
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
            {/* One row standing in for the whole Tools group. */}
            <li className="border-b border-white/10">
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setView("tools")}
                className={`${MOBILE_ROW} flex w-full items-center justify-between`}
              >
                Tools
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
          </ul>
        ) : (
          <div data-menu-view="tools" className="nav-drill-forward">
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
              {/* The same two groups as the desktop dropdown, so both
                  surfaces describe the site identically. */}
              {TOOL_GROUPS.map((group) => (
                <Fragment key={group.heading}>
                  <li className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600">
                    {group.heading}
                  </li>
                  {group.links.map((tool) => (
                    <li key={tool.to} className="border-b border-white/10">
                      <Link
                        to={tool.to}
                        onClick={onNavigate}
                        className={MOBILE_ROW}
                      >
                        {tool.label}
                      </Link>
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/*
       * Pinned OUTSIDE the scroll area, so the primary action is
       * reachable without scrolling from either view — and stays put
       * rather than sliding away when you drill into Tools.
       */}
      {/* Points at /get-started, not a dead "#": the client portal is
          not built, and the honest interim page says so next to a real
          phone number. */}
      <Link
        to="/get-started"
        onClick={onNavigate}
        className="glass-navy mt-4 block rounded-full px-4 py-2.5 text-center text-xs font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
      >
        Client Login
      </Link>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /** Which surface the nav is currently sitting over. */
  const [navTheme, setNavTheme] = useState<"dark" | "light">("dark");
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
   * covering decides how it should look. A section opts into the light
   * treatment with data-nav-theme-section="light" — today only the bone
   * #trading block does, but any future light section gets it by adding
   * that attribute, with no change here.
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
      const lightSections = document.querySelectorAll(
        '[data-nav-theme-section="light"]',
      );
      let overLight = false;
      for (const section of lightSections) {
        const rect = section.getBoundingClientRect();
        // Overlap test against the bar's band, not just its midpoint —
        // a partial overlap should already flip it.
        if (rect.top < bar.bottom && rect.bottom > bar.top) {
          overLight = true;
          break;
        }
      }
      setNavTheme(overLight ? "light" : "dark");
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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
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
            {NAV_LINKS.map((link) => {
              // A route entry is "active" on its own route; a hash
              // entry is active when scroll-spy has it in view.
              const isActive = link.to
                ? pathname === link.to
                : active === link.hash;
              const linkClass = `relative text-sm font-medium transition-colors duration-500 after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_10px_rgb(var(--azee-orange)/0.55)] after:transition-all after:duration-500 hover:text-white ${
                isActive ? "is-active text-white after:w-6" : "text-gray-300 after:w-0"
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
            {/* The standalone tool pages collapse into one dropdown so
                the top-level bar stays inside its 1024px width budget
                and future tool pages have room. */}
            <ToolsDropdown pathname={pathname} />
          </ul>

          {/* See the mobile counterpart: /get-started, not a dead "#". */}
          <Link
            to="/get-started"
            className="nav-cta glass-navy hidden whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98] lg:block"
          >
            Client Login
          </Link>

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
