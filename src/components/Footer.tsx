import { Link } from "react-router-dom";
import {
  IconFacebook,
  IconInstagram,
  IconLinkedIn,
  IconYouTube,
} from "./Icons";

const COLUMNS: { heading: string; links: string[] }[] = [
  {
    heading: "Markets",
    links: [
      "PSX Equities",
      "KMI-30 Stocks",
      "PMEX Commodities",
      "Currencies & Futures",
      "Corporate Calendar",
      "IPO Calendar",
      "Mutual Funds & ETFs",
    ],
  },
  {
    heading: "Research & News",
    links: [
      "Latest Market News",
      "Market Watch",
      "PSX Snapshot",
      "Research Portal",
      "Knowledge Centre",
      "Investor Resources",
    ],
  },
  {
    heading: "Company",
    links: [
      "About AZEE",
      "Careers",
      "Help Centre",
      "Forms & Downloads",
      "Open an Account",
      "Contact Us",
    ],
  },
];

/** Footer labels that have a real in-app destination. */
const LIVE_ROUTES: Record<string, string> = {
  "Market Watch": "/market-watch",
  // The KMI-30 / KMI All-Share index-membership filter on Market Watch
  // is the closest real destination for this label.
  "KMI-30 Stocks": "/market-watch",
  "Corporate Calendar": "/corporate-calendar",
  "Knowledge Centre": "/knowledge-centre",
};

const SOCIALS = [
  { label: "Facebook", icon: IconFacebook },
  { label: "Instagram", icon: IconInstagram },
  { label: "LinkedIn", icon: IconLinkedIn },
  { label: "YouTube", icon: IconYouTube },
];

export function Footer() {
  return (
    <footer className="footer-navy relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          {/* Brand + contact */}
          <div className="lg:col-span-2">
            <p className="text-sm font-bold tracking-[0.2em] text-white">
              AZEE TRADE
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-wide text-gray-400">
              PSX Trading &amp; Research
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-400">
              AZEE Securities (Pvt.) Ltd. — brokerage, equity research, and
              online trading for the Pakistan Stock Exchange and Pakistan
              Mercantile Exchange since 2003.
            </p>

            <address className="mt-6 space-y-1.5 text-sm not-italic leading-relaxed text-gray-400">
              <p>
                Suite 705, 7th Floor, Business &amp; Finance Centre, Karachi
              </p>
              <p>
                Helpline:{" "}
                <a
                  href="tel:+92111293293"
                  className="text-white/90 transition-colors duration-300 hover:text-white"
                >
                  +92 111-293-293
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:info@azeetrade.com"
                  className="text-white/90 transition-colors duration-300 hover:text-white"
                >
                  info@azeetrade.com
                </a>
              </p>
            </address>

            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full text-gray-300 transition-all duration-500 hover:scale-110 hover:bg-white/20 hover:text-white hover:shadow-[0_0_20px_rgb(var(--azee-blue)/0.25)]"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-300">
                {column.heading}
              </p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    {LIVE_ROUTES[link] ? (
                      // Labels with real destinations render as router
                      // links; the rest remain placeholders for now.
                      <Link
                        to={LIVE_ROUTES[link]}
                        className="text-sm text-gray-300 transition-colors duration-300 hover:text-white"
                      >
                        {link}
                      </Link>
                    ) : (
                      <a
                        href="#"
                        className="text-sm text-gray-300 transition-colors duration-300 hover:text-white"
                      >
                        {link}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Regulatory */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-xs leading-relaxed text-gray-300/80">
            AZEE Securities (Pvt.) Ltd. is a TREC Holder of the Pakistan Stock
            Exchange (TREC No. 108) and the Pakistan Mercantile Exchange ·
            SECP Registration No. 0041920 · CDC Participant ID 04184 · NCCPL
            Participant Code C0418401.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-gray-300/80">
            Investing in securities and commodity futures involves risk.
            Prices can go down as well as up, and past performance is not
            indicative of future results. Please read all account-opening and
            risk-disclosure documents carefully before trading. Complaints may
            be lodged with our compliance desk or through the SECP Service
            Desk Management System.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-300/80">
              © 2026 AZEE Securities (Pvt.) Ltd. All rights reserved.
            </p>
            <div className="flex gap-6">
              {["Privacy Policy", "Terms of Use", "Risk Disclosure"].map(
                (link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-xs text-gray-300/80 transition-colors duration-300 hover:text-white"
                  >
                    {link}
                  </a>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
