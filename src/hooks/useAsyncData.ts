import { useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncDataOptions {
  /**
   * When set, the hook silently refetches every `intervalMs` after the
   * first successful fetch. Background refetches never reset `data` or
   * `loading`; failures keep the last good data and surface `error`.
   */
  intervalMs?: number;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Runs an async fetcher once (or whenever its identity changes) and
 * tracks the result. Pass stable module-level service functions —
 * wrap parameterised calls in useCallback.
 *
 * With `options.intervalMs`, the hook keeps polling in the background
 * after the initial load: the initial fetch behaves exactly like the
 * non-polling path, and each interval tick swaps `data` in place with
 * no loading flicker. Changing `intervalMs` restarts only the
 * interval; changing the fetcher restarts the whole cycle.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  options?: UseAsyncDataOptions,
): AsyncState<T> {
  const intervalMs = options?.intervalMs;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [polling, setPolling] = useState(false);

  // Mirror of intervalMs readable inside the initial-fetch effect
  // without adding it to that effect's dependencies (an intervalMs
  // change must not rerun the initial fetch).
  const intervalMsRef = useRef(intervalMs);
  intervalMsRef.current = intervalMs;

  // Initial fetch — reruns only when the fetcher identity changes.
  useEffect(() => {
    let cancelled = false;
    setPolling(false);
    setState({ data: null, loading: true, error: null });
    fetcher().then(
      (data) => {
        if (cancelled) return;
        setState({ data, loading: false, error: null });
        // Polling starts only after a successful first fetch.
        if (intervalMsRef.current !== undefined) setPolling(true);
      },
      (cause: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: toError(cause) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  // Background polling — silent refetches that never touch `loading`
  // and never null out previously loaded data.
  useEffect(() => {
    if (!polling || intervalMs === undefined) return;
    let cancelled = false;
    const interval = setInterval(() => {
      fetcher().then(
        (data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        },
        (cause: unknown) => {
          if (!cancelled) {
            setState((previous) => ({
              data: previous.data,
              loading: false,
              error: toError(cause),
            }));
          }
        },
      );
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [polling, intervalMs, fetcher]);

  return state;
}
