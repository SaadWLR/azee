import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Router-level scroll behavior, mounted once in the root layout so it
 * applies uniformly to every current and future route:
 *
 * - Navigation WITH a hash scrolls to the matching element, then
 *   VERIFIES the element actually landed near the viewport top. The
 *   initial scrollIntoView animates (CSS scroll-behavior: smooth) and
 *   smooth scrolls are cancelable — by user input, engine quirks, or
 *   competing programmatic scrolls — so a fire-and-forget call can
 *   silently end with the page still at the top. If verification
 *   finds the target off-position, it forces an instant,
 *   non-cancelable jump (behavior: "instant" bypasses the CSS smooth
 *   setting entirely).
 * - The target may not exist yet (lazy-loaded route chunks), so the
 *   initial attempt retries briefly until the element appears.
 * - Navigation WITHOUT a hash scrolls to top (standard fresh-page
 *   behavior — React Router does not reset scroll by itself).
 *
 * Same-page anchor clicks (plain <a href="#..."> on the homepage) are
 * handled natively by the browser first; this effect then targets the
 * same element, so the two never fight. Scroll-spy only reads scroll
 * position and is unaffected.
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
    let findAttempts = 0;
    let forceAttempts = 0;

    /** "Close enough to the top" — matches the e2e assertions. */
    const NEAR_TOP_PX = 150;

    const verify = () => {
      if (cancelled) return;
      const element = document.getElementById(id);
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      if (Math.abs(top) <= NEAR_TOP_PX) return; // landed — done
      if (forceAttempts++ < 3) {
        // The smooth scroll was canceled or never ran; jump instantly
        // (cannot be interrupted mid-animation) and re-verify.
        window.scrollTo({ top: window.scrollY + top, behavior: "instant" });
        setTimeout(verify, 400);
      }
    };

    const tryScroll = () => {
      if (cancelled) return;
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView(); // smooth per CSS — the nice-UX path
        setTimeout(verify, 1200); // then confirm it actually landed
        return;
      }
      // Up to ~5s of retries covers lazy chunks; give up silently
      // after that rather than looping on a nonexistent id.
      if (findAttempts++ < 50) setTimeout(tryScroll, 100);
    };
    tryScroll();

    return () => {
      cancelled = true;
    };
  }, [pathname, hash]);

  return null;
}
