import { useEffect } from "react";

/** Site-wide defaults, mirroring the static values in index.html. */
const DEFAULT_TITLE = "AZEE Trade — Invest in the Pakistan Stock Exchange";
const DEFAULT_DESCRIPTION =
  "AZEE Trade — Pakistan Stock Exchange brokerage, equity research, and online trading by AZEE Securities (Pvt.) Ltd., PSX TREC Holder No. 108.";

function setMeta(selector: string, content: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

/**
 * Per-route document title + meta/social description. A tiny useEffect
 * hook rather than a library (react-helmet-async): this SPA only needs
 * document.title and a handful of <meta> tags refreshed on navigation,
 * which the platform does natively — no dependency warranted. Call once
 * near the top of each page component; passing nothing restores the
 * site-wide default (used by the homepage).
 *
 * These are client-side updates: correct for browser tabs and for
 * Google, which renders JS. Non-JS social scrapers still read the
 * static index.html defaults — a designed OG image plus prerendering
 * would be the next step there, out of scope here.
 */
export function usePageMeta(title?: string, description?: string) {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;

  useEffect(() => {
    document.title = resolvedTitle;
    setMeta('meta[name="description"]', resolvedDescription);
    setMeta('meta[property="og:title"]', resolvedTitle);
    setMeta('meta[property="og:description"]', resolvedDescription);
  }, [resolvedTitle, resolvedDescription]);
}
