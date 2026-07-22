import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

/** Homepage in-page section anchors (hash targets on "/"). */
const NAV_LINKS = [
  { label: "Markets", hash: "#markets" },
  { label: "Research", hash: "#research" },
  { label: "Trading", hash: "#trading" },
  { label: "Products", hash: "#products" },
  { label: "About", hash: "#about" },
];

/**
 * Standalone tool/resource pages, grouped under the desktop "Tools"
 * dropdown (and listed flat on mobile). Adding a future tool page —
 * e.g. Forex & Commodities or an Economic Calendar — is a one-line
 * entry here; nothing else needs wiring. "Calendar" is deliberately
 * short (the desktop bar's width budget); the destination is the full
 * Corporate Calendar page.
 */
const TOOL_LINKS = [
  { label: "Market Watch", to: "/market-watch" },
  { label: "Indices", to: "/indices" },
  { label: "Calendar", to: "/corporate-calendar" },
  { label: "Knowledge Centre", to: "/knowledge-centre" },
];

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
    "after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:bg-gradient-to-r after:from-blue-400/0 after:via-blue-400/90 after:to-blue-400/0 after:shadow-[0_0_8px_rgb(var(--azee-blue)/0.6)] after:transition-all after:duration-500";
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
        {TOOL_LINKS.map((tool) => (
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
    </li>
  );
}

/** Mobile dropdown: navigation links plus the client login action. */
function MobileMenu({
  open,
  onHome,
  onNavigate,
}: {
  open: boolean;
  onHome: boolean;
  onNavigate: () => void;
}) {
  return (
    <div
      className={`nav-glass mx-auto mt-2 max-w-6xl rounded-3xl p-5 transition-all duration-500 ease-out lg:hidden ${
        open
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <ul>
        {NAV_LINKS.map((link) => (
          <li key={link.hash} className="border-b border-white/10">
            {onHome ? (
              // Same-page anchor: native browser scroll, untouched.
              <a
                href={link.hash}
                onClick={onNavigate}
                className="block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              // Cross-route: client-side navigation; ScrollToHash in
              // the root layout scrolls to the section once home
              // renders.
              <Link
                to={`/${link.hash}`}
                onClick={onNavigate}
                className="block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
        {/* Tools group — same links as the desktop dropdown, listed
            flat here (mobile's vertical list has no width pressure). A
            small label groups them, mirroring the desktop grouping. */}
        <li className="px-1 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          Tools
        </li>
        {TOOL_LINKS.map((tool) => (
          <li key={tool.to} className="border-b border-white/10">
            <Link
              to={tool.to}
              onClick={onNavigate}
              className="block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white"
            >
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className="glass-navy mt-4 block rounded-full px-4 py-2.5 text-center text-xs font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
      >
        Client Login
      </a>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
    const targets = NAV_LINKS.map((link) =>
      document.getElementById(link.hash.slice(1)),
    ).filter((el): el is HTMLElement => el !== null);
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
          className={`nav-glass pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-2.5 sm:px-7 ${
            scrolled ? "nav-glass-scrolled" : ""
          }`}
        >
          {/* Identity — scrolls to top on the homepage, returns home
              from any other route. */}
          {onHome ? (
            <a href="#" className="shrink-0" aria-label="AZEE Securities — home">
              <BrandMark />
            </a>
          ) : (
            <Link to="/" className="shrink-0" aria-label="AZEE Securities — home">
              <BrandMark />
            </Link>
          )}

          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => {
              const linkClass = `relative text-sm font-medium transition-colors duration-500 after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:bg-gradient-to-r after:from-blue-400/0 after:via-blue-400/90 after:to-blue-400/0 after:shadow-[0_0_8px_rgb(var(--azee-blue)/0.6)] after:transition-all after:duration-500 hover:text-white ${
                active === link.hash
                  ? "text-white after:w-6"
                  : "text-gray-300 after:w-0"
              }`;
              return (
                <li key={link.hash} className="flex items-center">
                  {onHome ? (
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

          <a
            href="#"
            className="glass-navy hidden whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98] lg:block"
          >
            Client Login
          </a>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 hover:bg-white/10 active:scale-[0.95] lg:hidden"
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
