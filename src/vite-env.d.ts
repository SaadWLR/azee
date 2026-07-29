/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for the browser SDK. Optional by design — when absent,
   * Sentry is never initialized and silently no-ops (src/instrument.ts).
   */
  readonly VITE_SENTRY_DSN?: string;
}
