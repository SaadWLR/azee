import { useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { BRANCHES, CONTACT, HEAD_OFFICES } from "../data/company";
import type { Office } from "../data/company";

/*
 * /contact — every way to reach AZEE, transcribed from azeetrade.com
 * via src/data/company.ts.
 *
 * The enquiry form is CLIENT-ONLY: it composes a mailto: link from what
 * you type and hands off to your mail client. There is no backend, and
 * deliberately no pretence of one — a form that silently POSTs nowhere
 * (or worse, shows a fake "message sent" confirmation) would be the
 * exact dishonesty this rebuild has avoided everywhere else. The button
 * says what it does.
 *
 * The "Beware of Fraudulent Activities" warning on the source site is
 * NOT ported here — removed site-wide by an earlier decision.
 */

/** Renders one office/branch card. */
function OfficeCard({ office }: { office: Office }) {
  return (
    <div className="liquid-glass rounded-2xl px-5 py-5">
      <p className="text-sm font-semibold text-white">{office.name}</p>
      <address className="mt-2 space-y-2 text-sm not-italic leading-relaxed text-gray-300/90">
        <p>{office.address}</p>
        <p>
          <span className="text-gray-400">Tel: </span>
          {office.tel.map((number, i) => (
            <span key={number}>
              {i > 0 && <span className="text-gray-500">, </span>}
              <a
                href={`tel:${number.replace(/[^\d+]/g, "")}`}
                className="text-white/90 transition-colors duration-300 hover:text-white"
              >
                {number}
              </a>
            </span>
          ))}
        </p>
        {office.fax && (
          <p className="text-gray-400">
            Fax: <span className="text-gray-300/90">{office.fax}</span>
          </p>
        )}
        <p>
          <span className="text-gray-400">Email: </span>
          <a
            href={`mailto:${office.email}`}
            className="text-white/90 transition-colors duration-300 hover:text-white"
          >
            {office.email}
          </a>
        </p>
      </address>
    </div>
  );
}

/**
 * Client-side enquiry composer. Builds a mailto: URL — no network call,
 * no stored data, nothing sent without the visitor's own mail client.
 */
function EnquiryForm() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const body = [
    name ? `Name: ${name}` : "",
    "",
    message,
  ]
    .filter((line, i) => line !== "" || i === 1)
    .join("\n");

  const href = `mailto:${CONTACT.generalEmail}?subject=${encodeURIComponent(
    subject || "Website enquiry",
  )}&body=${encodeURIComponent(body)}`;

  const ready = message.trim().length > 0;
  const field =
    "liquid-glass w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

  return (
    <div className="liquid-glass glass-sheen rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        Send an enquiry
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        This form opens a pre-filled message in your own email app —
        nothing is submitted to this website and nothing is stored here.
        You can also write to us directly at{" "}
        <a
          href={`mailto:${CONTACT.generalEmail}`}
          className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
        >
          {CONTACT.generalEmail}
        </a>
        .
      </p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className={field}
          />
        </label>
        <label className="block">
          <span className="sr-only">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className={field}
          />
        </label>
        <label className="block">
          <span className="sr-only">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            rows={5}
            className={`${field} resize-y`}
          />
        </label>
      </div>

      {/*
       * href is always set, even while disabled: an <a> without one is
       * not a link at all — it drops out of the accessibility tree, so
       * a screen reader (and any role-based query) simply loses the
       * control rather than hearing it is unavailable. Unusable state
       * is carried by aria-disabled plus removal from the tab order and
       * pointer events, which is what "disabled" should mean here.
       */}
      <a
        href={href}
        aria-disabled={!ready}
        tabIndex={ready ? undefined : -1}
        onClick={(e) => {
          if (!ready) e.preventDefault();
        }}
        className={`glass-navy mt-5 block rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-500 ${
          ready
            ? "hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
            : "pointer-events-none opacity-40"
        }`}
      >
        Open in your email app
      </a>
    </div>
  );
}

export function ContactPage() {
  usePageMeta(
    "Contact AZEE Securities — Offices, Branches & Helpline | AZEE Trade",
    "Reach AZEE Securities (Pvt.) Ltd. — registered and corporate offices in Karachi, six branches across Karachi, Lahore and Rawalpindi, UAN helpline, and email.",
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Contact
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            Get in touch
          </h1>
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Call the helpline, email us, or visit any of our eight offices
            across Karachi, Lahore and Rawalpindi.
          </p>

          {/* ── Headline channels ─────────────────────────────────── */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="liquid-glass rounded-2xl px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300/80">
                UAN
              </p>
              <a
                href={CONTACT.uanHref}
                className="mt-2 block text-lg font-semibold text-white transition-colors duration-300 hover:text-blue-200"
              >
                {CONTACT.uan}
              </a>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                {CONTACT.hours}
              </p>
            </div>
            <div className="liquid-glass rounded-2xl px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300/80">
                General
              </p>
              <a
                href={`mailto:${CONTACT.generalEmail}`}
                className="mt-2 block break-all text-sm font-semibold text-white transition-colors duration-300 hover:text-blue-200"
              >
                {CONTACT.generalEmail}
              </a>
            </div>
            <div className="liquid-glass rounded-2xl px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300/80">
                Support
              </p>
              <a
                href={`mailto:${CONTACT.supportEmail}`}
                className="mt-2 block break-all text-sm font-semibold text-white transition-colors duration-300 hover:text-blue-200"
              >
                {CONTACT.supportEmail}
              </a>
            </div>
          </div>

          {/* ── Head offices ──────────────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Head offices
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {HEAD_OFFICES.map((office) => (
              <OfficeCard key={office.name} office={office} />
            ))}
          </div>

          {/* ── Branches ──────────────────────────────────────────── */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-white">
            Branches
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            {BRANCHES.length} branches — four in Karachi, one in Lahore, one in
            Rawalpindi.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {BRANCHES.map((office) => (
              <OfficeCard key={office.name} office={office} />
            ))}
          </div>

          {/* ── Enquiry ───────────────────────────────────────────── */}
          <div className="mt-12">
            <EnquiryForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
