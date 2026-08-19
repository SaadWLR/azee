import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import {
  ABOUT_PARAGRAPHS,
  DIRECTORS_MESSAGE,
  MEMBERSHIPS,
  REGULATORY,
  VISION_PARAGRAPHS,
} from "../data/company";

/*
 * /about — the company's own account of itself, its founder's message,
 * and its regulatory standing, all transcribed from azeetrade.com via
 * src/data/company.ts.
 *
 * Scope note: the homepage's WhyAzee and Stats sections are deliberately
 * untouched. This page consolidates the trust facts a prospective client
 * looks for BEFORE opening an account (who is this firm, who runs it,
 * what are they licensed to do) rather than restating the homepage's
 * product pitch.
 *
 * Nothing here is written by us: every paragraph, the vision, and the
 * Director's Message are the company's published words. The
 * "Beware of Fraudulent Activities" warning on the source site is NOT
 * ported — it was removed site-wide by an earlier decision.
 */

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`liquid-glass glass-sheen rounded-3xl px-6 py-8 sm:px-9 sm:py-10 ${className}`}
    >
      {children}
    </div>
  );
}

export function AboutPage() {
  usePageMeta(
    "About AZEE Securities — PSX TREC Holder Since 2003 | AZEE Trade",
    "AZEE Securities (Pvt.) Ltd. — a licensed Pakistan Stock Exchange TREC holder incorporated in 2003, its regulatory standing, exchange memberships, and a message from founder and CEO Mr. Amir Zia.",
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            About Us
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AZEE Securities (Pvt.) Ltd.
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />

          <SectionCard className="mt-8">
            {ABOUT_PARAGRAPHS.map((text, i) => (
              <p
                key={text.slice(0, 32)}
                className={`text-sm leading-relaxed text-gray-300/90 ${i > 0 ? "mt-4" : ""}`}
              >
                {text}
              </p>
            ))}
          </SectionCard>

          {/* ── Regulatory standing ───────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Registration &amp; licensing
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            The identifiers below are the firm&apos;s own registration and
            participant numbers. They can be verified independently with the
            issuing body — the SECP, the Pakistan Stock Exchange, the CDC and
            the NCCPL each publish their own registers.
          </p>
          <dl className="mt-5 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {REGULATORY.map((item) => (
              <div
                key={item.term}
                className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6"
              >
                <dt className="text-sm font-semibold text-gray-300 sm:w-64 sm:shrink-0">
                  {item.term}
                </dt>
                <dd className="text-sm tabular-nums text-white/90">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* ── Memberships ───────────────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Memberships &amp; participant status
          </h2>
          <ul className="mt-4 space-y-2.5">
            {MEMBERSHIPS.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-gray-300/90"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300/70"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* ── Vision ────────────────────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Our vision
          </h2>
          <SectionCard className="mt-4">
            {VISION_PARAGRAPHS.map((text, i) => (
              <p
                key={text.slice(0, 32)}
                className={`text-sm leading-relaxed text-gray-300/90 ${i > 0 ? "mt-4" : ""}`}
              >
                {text}
              </p>
            ))}
          </SectionCard>

          {/* ── Director's message ────────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Director&apos;s message
          </h2>
          <SectionCard className="mt-4">
            <figure>
              <blockquote>
                {DIRECTORS_MESSAGE.paragraphs.map((text, i) => (
                  <p
                    key={text.slice(0, 32)}
                    className={`text-sm leading-relaxed text-gray-300/90 ${i > 0 ? "mt-4" : ""}`}
                  >
                    {text}
                  </p>
                ))}
              </blockquote>
              <figcaption className="mt-6 border-t border-white/10 pt-5">
                <p className="text-sm font-semibold text-white">
                  {DIRECTORS_MESSAGE.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {DIRECTORS_MESSAGE.role}
                </p>
              </figcaption>
            </figure>
          </SectionCard>

          {/* ── Where to go next ──────────────────────────────────── */}
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/contact"
              className="glass-navy rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
            >
              Contact us
            </Link>
            <Link
              to="/regulatory-information"
              className="liquid-glass rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-500 hover:bg-white/15 active:scale-[0.98]"
            >
              Regulatory information
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
