import { useLayoutEffect, useRef, useState } from "react";
import { FadeIn } from "./FadeIn";

const NAV_LINKS = ["Markets", "Research", "Trading", "Products", "About"];

/** Mobile dropdown: navigation links plus the client login action. */
function MobileMenu({ open }: { open: boolean }) {
  return (
    <div
      className={`liquid-glass-strong mx-auto mt-2 max-w-6xl rounded-3xl p-5 transition-all duration-300 ease-out lg:hidden ${
        open
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <ul>
        {NAV_LINKS.map((link) => (
          <li key={link} className="border-b border-white/10">
            <a
              href="#"
              className="block py-3 text-sm font-medium text-gray-300 transition-colors duration-300 hover:text-white"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className="liquid-glass mt-4 block rounded-full px-4 py-2.5 text-center text-xs font-semibold text-white transition-all duration-300 hover:bg-white/20"
      >
        Client Login
      </a>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6"
    >
      <FadeIn delay={100}>
        <nav
          ref={navRef}
          className="liquid-glass mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-5 py-3 sm:px-8"
        >
          {/* Identity */}
          <a href="#" className="shrink-0">
            <p className="text-sm font-bold leading-tight tracking-[0.2em] text-white">
              AZEE TRADE
            </p>
            <p className="text-[10px] font-medium leading-tight tracking-wide text-gray-300">
              PSX Trading &amp; Research
            </p>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link}>
                <a
                  href="#"
                  className="text-sm font-medium text-gray-300 transition-colors duration-300 hover:text-white"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#"
            className="liquid-glass hidden whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-white/20 lg:block"
          >
            Client Login
          </a>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="liquid-glass flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full lg:hidden"
          >
            <span
              className={`h-px w-4 bg-white transition-transform duration-300 ${
                menuOpen ? "translate-y-[3px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-px w-4 bg-white transition-transform duration-300 ${
                menuOpen ? "-translate-y-[3px] -rotate-45" : ""
              }`}
            />
          </button>
        </nav>
      </FadeIn>

      <MobileMenu open={menuOpen} />
    </header>
  );
}
