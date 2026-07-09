import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FadeIn } from "./FadeIn";

const NAV_LINKS = [
  { label: "Markets", href: "#markets" },
  { label: "Research", href: "#research" },
  { label: "Trading", href: "#trading" },
  { label: "Products", href: "#products" },
  { label: "About", href: "#about" },
];

/** Mobile dropdown: navigation links plus the client login action. */
function MobileMenu({
  open,
  onNavigate,
}: {
  open: boolean;
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
          <li key={link.href} className="border-b border-white/10">
            <a
              href={link.href}
              onClick={onNavigate}
              className="block py-3 text-sm font-medium text-gray-300 transition-colors duration-500 hover:text-white"
            >
              {link.label}
            </a>
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
      document.getElementById(link.href.slice(1)),
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
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5"
    >
      <FadeIn delay={100}>
        <nav
          ref={navRef}
          className={`nav-glass mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-2.5 sm:px-7 ${
            scrolled ? "nav-glass-scrolled" : ""
          }`}
        >
          {/* Identity */}
          <a href="#" className="shrink-0">
            <p className="text-sm font-bold leading-tight tracking-[0.2em] text-white">
              AZEE TRADE
            </p>
            <p className="text-[10px] font-medium leading-tight tracking-wide text-gray-400">
              PSX Trading &amp; Research
            </p>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href} className="flex items-center">
                <a
                  href={link.href}
                  className={`relative text-sm font-medium transition-colors duration-500 after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:bg-gradient-to-r after:from-blue-400/0 after:via-blue-400/90 after:to-blue-400/0 after:shadow-[0_0_8px_rgb(var(--azee-blue)/0.6)] after:transition-all after:duration-500 hover:text-white ${
                    active === link.href
                      ? "text-white after:w-6"
                      : "text-gray-300 after:w-0"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            ))}
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
            className="liquid-glass flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full transition-all duration-500 active:scale-[0.95] lg:hidden"
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

      <MobileMenu open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    </header>
  );
}
