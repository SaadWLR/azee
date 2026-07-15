import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Router-level scroll behavior, mounted once in the root layout so it
 * applies uniformly to every current and future route:
 *
 * - Navigation WITH a hash scrolls to the matching element. The
 *   target may not exist yet (lazy-loaded route chunks, or homepage
 *   sections still mounting), so it retries briefly until the element
 *   appears rather than firing into an empty DOM.
 * - Navigation WITHOUT a hash scrolls to top (standard fresh-page
 *   behavior — React Router does not reset scroll by itself).
 *
 * Same-page anchor clicks (plain <a href="#..."> on the homepage) are
 * handled natively by the browser first; this effect then scrolls to
 * the same element, which is a no-op destination-wise, so the two
 * never fight. Scroll-spy reads scroll position and is unaffected.
 */
export function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = hash.slice(1);
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
        return;
      }
      // Up to ~5s of retries covers lazy chunks and reveal-delayed
      // sections; give up silently after that rather than looping
      // forever on a genuinely nonexistent id.
      if (attempts++ < 50) setTimeout(tryScroll, 100);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [pathname, hash]);

  return null;
}
