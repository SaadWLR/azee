import { useEffect, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Runs an async fetcher once (or whenever its identity changes) and
 * tracks the result. Pass stable module-level service functions —
 * wrap parameterised calls in useCallback.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetcher().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      },
      (cause: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return state;
}
