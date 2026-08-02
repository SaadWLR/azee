import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Consent banner for error-monitoring session recording.
 *
 * WHY THIS EXISTS: Sentry's Session Replay begins recording on page
 * load. Before this banner, that happened with no consent mechanism of
 * any kind — verified live on production, where a `sentryReplaySession`
 * entry and an active replay id were created immediately on first
 * visit. This gives visitors a real choice and records it.
 *
 * The choice is stored in localStorage rather than a cookie, because
 * this site sets no cookies at all and adding one purely to record a
 * cookie preference would be self-defeating. `azee-consent` is the only
 * thing this site persists.
 *
 * Scope note, stated plainly: this banner records and honours the
 * choice from the moment it is made, and stops replay on reject. It
 * does NOT defer Sentry's initialization until consent, so on a first
 * visit a short buffer may exist before the visitor chooses. Closing
 * that remaining gap means moving Sentry.init behind consent in
 * src/instrument.ts, which changes error-capture behaviour and is a
 * deliberate follow-up rather than something to slip in here.
 */

const STORAGE_KEY = "azee-consent";
type Choice = "accepted" | "rejected";

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    // Private mode / storage disabled — behave as undecided, and never
    // let a storage failure break the page.
    return null;
  }
}

/** Stops Sentry's Replay recording, if it is running. */
function stopReplay() {
  try {
    const carrier = (
      window as unknown as {
        __SENTRY__?: Record<string, { defaultCurrentScope?: { getClient?: () => unknown } }>;
      }
    ).__SENTRY__;
    if (!carrier) return;
    const version = Object.keys(carrier).find((k) => /^\d/.test(k));
    const scope = version ? carrier[version]?.defaultCurrentScope : undefined;
    const client = scope?.getClient?.() as
      | { getIntegrationByName?: (n: string) => { stop?: () => void } | undefined }
      | undefined;
    client?.getIntegrationByName?.("Replay")?.stop?.();
  } catch {
    // Never let consent handling throw into the page.
  }
}

export function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);

  // Read once on mount; `undefined` means "not yet read", so the banner
  // never flashes for someone who already chose.
  useEffect(() => {
    const existing = readChoice();
    setChoice(existing);
    if (existing === "rejected") stopReplay();
  }, []);

  function decide(next: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — honour the choice for this session only */
    }
    if (next === "rejected") stopReplay();
    setChoice(next);
  }

  if (choice === undefined || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie and session recording consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="nav-glass mx-auto flex max-w-4xl flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <p className="flex-1 text-xs leading-relaxed text-gray-300">
          This site sets{" "}
          <span className="font-semibold text-white">no cookies</span> and uses
          no analytics or advertising trackers. We do use error monitoring,
          which can record a masked replay of a session to diagnose faults.
          You can decline it.{" "}
          <Link
            to="/cookie-policy"
            className="text-white underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blue-300"
          >
            Cookie Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            onClick={() => decide("rejected")}
            className="liquid-glass rounded-full px-5 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/10 active:scale-[0.98]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            className="glass-navy rounded-full px-5 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
