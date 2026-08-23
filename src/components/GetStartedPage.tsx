import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { CONTACT, HEAD_OFFICES } from "../data/company";

/*
 * /get-started — the honest interim destination for "Open an Account"
 * and "Client Login".
 *
 * Both used to be href="#": a control that looks live, does nothing,
 * and on a licensed brokerage sits exactly where a prospective client
 * is deciding whether to trust the firm. This page exists because the
 * online onboarding and client portal are not built yet, and saying so
 * plainly — next to a real phone number and a real office — is worth
 * more than a button that swallows the click.
 *
 * NOT ported from the source site: the "Beware of Fraudulent
 * Activities" warning, removed site-wide by an earlier decision. Also
 * deliberately absent: any account-opening form, document upload, or
 * "apply online" flow. None of that exists yet and none of it may be
 * mocked up on a page a real client could mistake for the real thing.
 */

/** What a visitor should do instead, while onboarding is being built. */
const ROUTES_IN: { label: string; detail: string; href: string }[] = [
  {
    label: "Call the UAN",
    detail: `${CONTACT.uan} · ${CONTACT.hours}`,
    href: CONTACT.uanHref,
  },
  {
    label: "Email us",
    detail: CONTACT.generalEmail,
    href: `mailto:${CONTACT.generalEmail}`,
  },
];

export function GetStartedPage() {
  usePageMeta(
    "Open an Account — Talk to AZEE Securities | AZEE Trade",
    "Online account opening and the client portal are being built. In the meantime, open an account with AZEE Securities by phone, by email, or at any of our offices in Karachi, Lahore and Rawalpindi.",
  );

  const registered = HEAD_OFFICES[0];

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Get Started
          </p>
          <h1 className="font-display mt-3 text-[2.5rem] text-[rgb(var(--azee-chalk))] sm:text-5xl">
            Open an account with AZEE
          </h1>
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />

          <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
              Online onboarding — coming soon
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              Online account opening and the client login portal are still
              being built. Rather than show you a form that cannot yet submit
              anything, we would rather tell you plainly and give you the
              routes that do work today.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300/90">
              Accounts are opened through our team. Call or email us and we
              will walk you through the account-opening documents, the Know
              Your Customer requirements, and what you will need to have to
              hand.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {ROUTES_IN.map((route) => (
                <a
                  key={route.label}
                  href={route.href}
                  className="liquid-glass group rounded-2xl px-5 py-4 transition-all duration-500 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">
                    {route.label}
                  </p>
                  <p className="mt-1 break-words text-xs leading-relaxed text-gray-400">
                    {route.detail}
                  </p>
                </a>
              ))}
            </div>

            <p className="mt-7 text-sm leading-relaxed text-gray-400">
              You can also walk into any of our offices. The registered office
              is at {registered.address}.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/contact"
              className="glass-navy rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-500 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
            >
              All offices &amp; branches
            </Link>
            <Link
              to="/forms-downloads"
              className="liquid-glass rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-500 hover:bg-white/15 active:scale-[0.98]"
            >
              Account-opening forms
            </Link>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-gray-400/90">
            Already a client? The online portal is not live yet — for account
            access, statements or trade queries, call the UAN above or contact
            your branch directly.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
