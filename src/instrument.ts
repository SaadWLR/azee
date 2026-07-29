import * as Sentry from "@sentry/react";

/**
 * Sentry browser SDK — error monitoring and session replay.
 *
 * Lives in its own module, imported FIRST in main.tsx: ES modules are
 * evaluated depth-first in import order, so this body runs before the
 * app's own modules and before React mounts. That is the earliest
 * point the SDK can install its global handlers.
 *
 * The DSN is read from the environment, never hardcoded — the Sentry
 * setup wizard's example inlines it, which would bake a project
 * identifier into the repo and into every built bundle.
 *
 * GRACEFUL DEGRADATION: with no VITE_SENTRY_DSN the SDK is simply
 * never initialized, so it no-ops — `Sentry.captureException` and
 * friends stay callable but do nothing, and nothing throws. Same
 * principle as every other integration here: a missing credential
 * degrades the feature, never the site.
 *
 * SCOPE: error monitoring + session replay ONLY. Tracing, Logging and
 * Application Metrics are deliberately deferred — hence no
 * `browserTracingIntegration`, no `tracesSampleRate`, and no log
 * forwarding. Adding any of those is a separate decision, not a
 * default that should drift in.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.replayIntegration()],
    /*
     * 10% of ordinary sessions are recorded, but a session that hits
     * an error is always recorded — the error case is the one worth
     * watching back, and this is exactly the gap that made the
     * KSE-100 count-up question hard to settle from automated-tab
     * reproduction alone.
     */
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
