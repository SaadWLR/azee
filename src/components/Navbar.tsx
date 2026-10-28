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
 * A route link: a plain top-level entry, or one inside a group's panel.
 * `to` may carry a query string — a deep link into one view of a page
 * (see NAV_ENTRIES) — and active state reads it (see findActiveLink).
 */
interface NavLink {
  label: string;
  to: string;
}

/**
 * A run of links inside a group's panel, optionally under a sub-heading.
 * A sub-heading is a LABEL, not a nested menu: it is not focusable or
 * clickable, and its links sit in the same panel as the rest.
 */
interface NavSection {
  heading?: string;
  links: NavLink[];
}

/** A top-level dropdown: its trigger label and its panel's sections. */
interface NavGroup {
  heading: string;
  sections: NavSection[];
}

type NavEntry = NavLink | NavGroup;

/**
 * THE NAVIGATION, left to right:
 *
 *   Home · Trade & Invest ▾ · Market ▾ · Tools ▾ · Knowledge Centre · Support ▾
 *
 * This array is the only definition of the site's navigation. The
 * desktop bar and the mobile drill-down both render it in this order, so
 * a change here moves both and they cannot drift apart.
 *
 * EVERY LINK IS A ROUTE THAT EXISTS TODAY. A page that is planned but not
 * built (platforms, live blogs, press releases, glossary, help centre,
 * careers, currency converter, market news, calculators) is added here
 * when it lands, never before.
 *
 * Trade & Invest is what a client can take a position in; Market is
 * where prices are read. Some pages sit in both on purpose: Stocks and
 * Market Watch are the same route, as are Pakistan Indices and the
 * Futures view beside it. IPO and Economic Calendar sit with the other
 * calendars under Tools, and Global Indices beside Pakistan Indices.
 *
 * DEEP LINKS. Three entries open one view of a page rather than its
 * default, using a query parameter the page itself reads on a cold load
 * and on in-app navigation:
 *  - Shariah Compliant Stocks → /market-watch?preset=kmiAllShare, Market
 *    Watch's KMI All-Share filter (KMI All-Share, not KMI-30: it is the
 *    full Shariah-screened universe, of which KMI-30 is a subset).
 *  - Futures → /indices?tab=global, the PMEX index-futures tab of the
 *    indices page; there is no separate futures page.
 *  - Dividend Calendar → /corporate-calendar?tab=payouts, the Payouts tab.
 *
 * "Home" sits alongside the logo, which also leads home. On the homepage
 * itself both scroll back to the top instead of re-navigating to the
 * page already showing (see scrollHomeToTop).
 */
const NAV_ENTRIES: NavEntry[] = [
  { label: "Home", to: "/" },
  {
    heading: "Trade & Invest",
    sections: [
      {
        links: [
          { label: "Stocks", to: "/market-watch" },
          { label: "Shariah Compliant Stocks", to: "/market-watch?preset=kmiAllShare" },
          { label: "Futures", to: "/indices?tab=global" },
          { label: "Commodities", to: "/commodities" },
          { label: "Currency", to: "/forex" },
          { label: "Mutual Funds", to: "/mutual-funds" },
        ],
      },
    ],
  },
  {
    heading: "Market",
    sections: [
      {
        heading: "Stocks",
        links: [
          { label: "Market Watch", to: "/market-watch" },
          { label: "ETFs", to: "/etfs" },
        ],
      },
      {
        heading: "Indices",
        links: [
          { label: "Pakistan Indices", to: "/indices" },
          { label: "Global Indices", to: "/global-indices" },
        ],
      },
      { links: [{ label: "Crypto", to: "/crypto" }] },
    ],
  },
  {
    heading: "Tools",
    sections: [
      {
        heading: "Calendars",
        links: [
          { label: "Dividend Calendar", to: "/corporate-calendar?tab=payouts" },
          { label: "Corporate Calendar", to: "/corporate-calendar" },
          { label: "IPO Calendar", to: "/ipo" },
          { label: "Economic Calendar", to: "/economic-calendar" },
        ],
      },
      {
        heading: "Data & Research",
        links: [
          { label: "Announcements", to: "/announcements" },
          { label: "Economic Dashboard", to: "/economic-dashboard" },
          { label: "Fear and Optimism Index", to: "/fear-and-optimism-index" },
        ],
      },
    ],
  },
  { label: "Knowledge Centre", to: "/knowledge-centre" },
  {
    heading: "Support",
    sections: [
      {
        links: [
          { label: "About Us", to: "/about" },
          { label: "Contact Us", to: "/contact" },
          { label: "Download Forms", to: "/forms-downloads" },
        ],
      },
    ],
  },
];

function isGroup(entry: NavEntry): entry is NavGroup {
  return "sections" in entry;
}

function groupLinks(group: NavGroup): NavLink[] {
  return group.sections.flatMap((section) => section.links);
}

/** A stable slug for a group — the mobile menu's view key and panel id. */
function groupSlug(group: NavGroup): string {
  return group.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ALL_LINKS: NavLink[] = NAV_ENTRIES.flatMap((entry) =>
  isGroup(entry) ? groupLinks(entry) : [entry],
);

/**
 * ACTIVE STATE: at most one link is active, decided by route AND query.
 *
 * A link matches when its path equals the current path and every query
 * parameter it carries has the same value in the current URL; extra
 * parameters in the URL are ignored. Of the matches, the one carrying
 * the most parameters wins, so /market-watch?preset=kmiAllShare lights
 * Shariah Compliant Stocks and not Stocks, while /market-watch alone (or
 * with another preset) lights Stocks. A tie — two links to the identical
 * route, like Trade & Invest's Stocks and Market's Market Watch — goes to
 * the one earlier in NAV_ENTRIES, so the bar never lights two entries for
 * one page. A group is active when its panel holds the active link.
 */
function findActiveLink(pathname: string, search: string): NavLink | undefined {
  const current = new URLSearchParams(search);
  let best: NavLink | undefined;
  let bestParams = -1;
  for (const link of ALL_LINKS) {
    const [path, query = ""] = link.to.split("?");
    if (path !== pathname) continue;
    const params = [...new URLSearchParams(query)];
    if (!params.every(([key, value]) => current.get(key) === value)) continue;
    if (params.length > bestParams) {
      best = link;
      bestParams = params.length;
    }
  }
  return best;
}

/**
 * `inert` while hidden: a closed panel keeps its markup (it fades rather
 * than unmounting), and inert takes it out of the tab order and the
 * accessibility tree until it opens. React 18 has no typed `inert` prop,
 * so it is passed as the plain attribute.
 */
function inertUnless(open: boolean): Record<string, string> {
  return open ? {} : { inert: "" };
}

/**
 * Home, clicked on the homepage, scrolls back to the top — as the logo
 * does there. Without this it would "navigate" to the page already
 * showing and do nothing: the router's scroll reset only runs when the
 * path or hash actually changes.
 */
function scrollHomeToTop(link: NavLink, pathname: string) {
  if (link.to === "/" && pathname === "/") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/** The least room a panel keeps from either edge of the viewport. */
const PANEL_VIEWPORT_MARGIN = 16;

/**
 * One desktop top-level dropdown: a group's trigger and its panel.
 *
 * Click-to-open (robust on touch/hybrid devices, unlike hover-only),
 * closing on: the trigger again, an outside click (which includes
 * opening a sibling dropdown, so only one is ever open), Escape (which
 * returns focus to the trigger), focus moving out of it by keyboard, a
 * navigation, or picking a link. The trigger wears the link treatment
 * and the active underline when its panel holds the active link.
 *
 * POSITION: centred under its trigger. If centring would ever put an
 * edge closer than PANEL_VIEWPORT_MARGIN to the side of the viewport,
 * the panel slides inward just far enough; this is measured on every
 * open and on resize. At today's widths no panel needs it — measured at
 * 1024px, the tightest case is Support, whose panel ends 81px inside the
 * viewport — so it guards a longer label or a later trigger, not a
 * current layout.
 */
function NavDropdown({
  group,
  pathname,
  search,
  activeLink,
}: {
  group: NavGroup;
  pathname: string;
  search: string;
  activeLink: NavLink | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `nav-panel-${groupSlug(group)}`;

  const links = groupLinks(group);
  const active = activeLink !== undefined && links.includes(activeLink);

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

  // Any navigation dismisses the menu, including one that only changes
  // the query (a deep link into the page already showing).
  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  // Centre under the trigger, clamped inside the viewport (see above).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const { left, width } = trigger.getBoundingClientRect();
      const ideal = left + width / 2 - panel.offsetWidth / 2;
      const max = document.documentElement.clientWidth - PANEL_VIEWPORT_MARGIN - panel.offsetWidth;
      const clamped = Math.min(Math.max(ideal, PANEL_VIEWPORT_MARGIN), max);
      setShift(Math.round(clamped - ideal));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  const underline =
    "after:absolute after:-bottom-1.5 after:left-1/2 after:h-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_12px_rgb(var(--azee-orange)/0.7)] after:transition-all after:duration-500";
  const triggerState = active
    ? // `is-active` is the semantic marker the link treatment already
      // uses, and index.css styles it for BUTTONS too.
      "is-active text-white after:w-7"
    : open
      ? "text-white after:w-0"
      : "text-gray-300 after:w-0";

  return (
    <li
      ref={containerRef}
      className="relative flex items-center"
      // Tabbing out of the panel closes it. A null relatedTarget (focus
      // going nowhere, as a Safari click on a link does) is not a move
      // out, so a pointer pick is never cut short.
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
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

      {/* w-60: the widest label, "Shariah Compliant Stocks", fits on one line. */}
      <div
        ref={panelRef}
        id={panelId}
        role="menu"
        aria-label={group.heading}
        {...inertUnless(open)}
        style={{ marginLeft: shift }}
        className={`nav-glass absolute left-1/2 top-[calc(100%+1.5rem)] w-60 -translate-x-1/2 rounded-2xl p-2 transition-all duration-300 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        {group.sections.map((section, index) => {
          const headingId = section.heading
            ? `${panelId}-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
            : undefined;
          return (
            <div
              key={section.heading ?? index}
              role={headingId ? "group" : undefined}
              aria-labelledby={headingId}
              className={index > 0 ? "mt-1 border-t border-white/10 pt-1" : undefined}
            >
              {section.heading && (
                <p
                  id={headingId}
                  role="presentation"
                  className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500"
                >
                  {section.heading}
                </p>
              )}
              {section.links.map((link) => {
                const current = link === activeLink;
                return (
                  <Link
                    key={link.label}
                    to={link.to}
                    role="menuitem"
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-300 ${
                      current
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
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

/** The small uppercase label that names a group or section in the mobile menu. */
const MOBILE_LABEL =
  "px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em]";

/**
 * Mobile dropdown: the same entries, in the same order, as the desktop
 * bar (NAV_ENTRIES) — plain links as rows, each group as a drill-down.
 *
 * The top level shows one row per entry; tapping a group swaps in a
 * view holding only that group's links, under its sub-headings, with a
 * Back row first. Keyboard: drilling in focuses Back, and Back returns
 * focus to the group's row, so a keyboard user never lands on nothing.
 *
 * The scroll bound is deliberate even though every view fits a phone
 * today: a height cap turns a future overflow into a scroll instead of a
 * silent truncation off the bottom of the screen.
 */
function MobileMenu({
  open,
  pathname,
  activeLink,
  onNavigate,
}: {
  open: boolean;
  pathname: string;
  activeLink: NavLink | undefined;
  onNavigate: () => void;
}) {
  /** "main", or the slug of the group whose drill-down is showing. */
  const [view, setView] = useState("main");
  const drilled = NAV_ENTRIES.find(
    (entry): entry is NavGroup => isGroup(entry) && groupSlug(entry) === view,
  );
  const backRef = useRef<HTMLButtonElement>(null);
  const groupRowRefs = useRef(new Map<string, HTMLButtonElement>());
  /** The group to refocus after Back, so focus returns where it left. */
  const returnTo = useRef<string | null>(null);

  /*
   * Reopening always starts at the top level. Reset on close rather
   * than on open so it happens behind the closing fade, never as a
   * visible flip while the panel is still on screen.
   */
  useEffect(() => {
    if (!open) {
      setView("main");
      returnTo.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view !== "main") {
      backRef.current?.focus({ preventScroll: true });
    } else if (returnTo.current) {
      groupRowRefs.current.get(returnTo.current)?.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [view, open]);

  return (
    <div
      id="mobile-menu"
      aria-label="Site menu"
      {...inertUnless(open)}
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
       * plus a 0.75rem gap above the screen edge.
       */}
      <div className="max-h-[calc(100dvh-var(--nav-height)-3.75rem)] overflow-y-auto overscroll-contain">
        {!drilled ? (
          <ul data-menu-view="main" className="nav-drill-back">
            {NAV_ENTRIES.map((entry) =>
              isGroup(entry) ? (
                // One row per group, standing in for its whole link set.
                <li key={entry.heading} className="border-b border-white/10">
                  <button
                    ref={(el) => {
                      if (el) groupRowRefs.current.set(groupSlug(entry), el);
                      else groupRowRefs.current.delete(groupSlug(entry));
                    }}
                    type="button"
                    aria-haspopup="true"
                    onClick={() => setView(groupSlug(entry))}
                    className={`${MOBILE_ROW} flex w-full items-center justify-between`}
                  >
                    {entry.heading}
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
              ) : (
                <li key={entry.to} className="border-b border-white/10">
                  <Link
                    to={entry.to}
                    aria-current={entry === activeLink ? "page" : undefined}
                    onClick={() => {
                      scrollHomeToTop(entry, pathname);
                      onNavigate();
                    }}
                    className={MOBILE_ROW}
                  >
                    {entry.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        ) : (
          <div data-menu-view={view} className="nav-drill-forward">
            {/* Back first, and full-width: on a phone the top-left of
                the panel is where a back control is looked for, and a
                wide target is easier to hit than a bare chevron. */}
            <button
              ref={backRef}
              type="button"
              onClick={() => {
                returnTo.current = view;
                setView("main");
              }}
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
              <li className={`${MOBILE_LABEL} text-gray-600`}>{drilled.heading}</li>
              {drilled.sections.flatMap((section, index) => [
                ...(section.heading
                  ? [
                      <li key={`heading-${section.heading}`} className={`${MOBILE_LABEL} text-gray-500`}>
                        {section.heading}
                      </li>,
                    ]
                  : index > 0
                    ? [<li key={`gap-${index}`} aria-hidden="true" className="pt-3" />]
                    : []),
                ...section.links.map((link) => (
                  <li key={link.label} className="border-b border-white/10">
                    <Link
                      to={link.to}
                      aria-current={link === activeLink ? "page" : undefined}
                      onClick={onNavigate}
                      className={MOBILE_ROW}
                    >
                      {link.label}
                    </Link>
                  </li>
                )),
              ])}
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
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { pathname, search } = useLocation();
  const onHome = pathname === "/";
  const activeLink = findActiveLink(pathname, search);

  // Escape closes the mobile menu and hands focus back to its toggle.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

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
          className={`nav-glass pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-2.5 sm:px-7 lg:gap-0 ${
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

          {/*
           * BALANCE: the links sit centred in the space between the logo
           * and the bar's right edge, via lg:mx-auto, with lg:px-4 as
           * the minimum clearance on both sides. The bar is a
           * justify-between row of two children at lg (the mobile toggle
           * is hidden), so without the auto margins all of its free space
           * would fall between the logo and the links and pin them to the
           * right edge. The row's gap-4 is dropped at lg because it would
           * apply on the logo's side only and unbalance the two gaps.
           *
           * WIDTH BUDGET, measured at the 1024px breakpoint where this bar
           * first appears: the six entries and their gaps take 600px of
           * the 920px inner bar, leaving 113px before Home and 114px after
           * Support, each including the 16px minimum clearance. No label
           * wraps. A seventh entry has to fit inside that headroom, so
           * measure again rather than assuming it does.
           */}
          <ul className="nav-themed hidden items-center gap-7 lg:mx-auto lg:flex lg:px-4">
            {NAV_ENTRIES.map((entry) => {
              if (isGroup(entry)) {
                return (
                  <NavDropdown
                    key={entry.heading}
                    group={entry}
                    pathname={pathname}
                    search={search}
                    activeLink={activeLink}
                  />
                );
              }
              const isActive = entry === activeLink;
              const linkClass = `relative text-sm font-medium transition-colors duration-500 after:absolute after:-bottom-1.5 after:left-1/2 after:h-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--azee-orange))] after:shadow-[0_0_12px_rgb(var(--azee-orange)/0.7)] after:transition-all after:duration-500 hover:text-white ${
                isActive ? "is-active text-white after:w-7" : "text-gray-300 after:w-0"
              }`;
              return (
                <li key={entry.to} className="flex items-center">
                  <Link
                    to={entry.to}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => scrollHomeToTop(entry, pathname)}
                    className={linkClass}
                  >
                    {entry.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Mobile menu toggle */}
          <button
            ref={toggleRef}
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
        pathname={pathname}
        activeLink={activeLink}
        onNavigate={() => setMenuOpen(false)}
      />
    </header>
  );
}
