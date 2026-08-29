import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";

/*
 * Catch-all 404. Before this existed an unknown path rendered nothing
 * under the SPA rewrite — a blank screen, which reads as a broken site
 * rather than a wrong address.
 *
 * It keeps the full Navbar and Footer on purpose: the fastest way out
 * of a wrong URL is the site's own navigation, and a stripped-down
 * error page would take that away exactly when it is most needed.
 *
 * Note on status codes: the host serves the SPA shell with HTTP 200 for
 * every path (that rewrite is what makes client-side routing work), so
 * this page cannot itself return 404. It is marked noindex instead so
 * search engines do not index wrong addresses — see usePageMeta.
 */

/** The routes worth offering someone who landed nowhere. */
const SUGGESTIONS: { label: string; to: string; detail: string }[] = [
  { label: "Market Watch", to: "/market-watch", detail: "Live PSX quotes" },
  { label: "PSX Indices", to: "/indices", detail: "Benchmark index levels" },
  {
    label: "Corporate Calendar",
    to: "/corporate-calendar",
    detail: "AGMs and payouts",
  },
  { label: "Contact", to: "/contact", detail: "Offices and branches" },
];

export function NotFoundPage() {
  usePageMeta(
    "Page Not Found | AZEE Trade",
    "That address does not exist on azee.vercel.app. Use the links here to reach live PSX market data, the corporate calendar, or our contact details.",
    { noindex: true },
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Error 404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            We can&apos;t find that page
          </h1>
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            The address you followed doesn&apos;t match anything on this site.
            It may have been mistyped, or the page may have moved.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="liquid-glass group rounded-2xl px-5 py-4 transition-all duration-500 hover:bg-white/10"
              >
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-gray-400">{item.detail}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <Link
              to="/"
              className="glass-navy inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
            >
              Back to the homepage
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
