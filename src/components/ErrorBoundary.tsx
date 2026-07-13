import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Names the failed region in the fallback copy and the error log
   * (e.g. "the market news section"). Omit for the app-level
   * boundary, which falls back to page-level copy and a full reload.
   */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class component by necessity — componentDidCatch /
 * getDerivedStateFromError still have no hook equivalent. Renders
 * children untouched until one of them throws during render, then
 * shows an honest on-brand fallback instead of white-screening.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Never swallow — keep the real error debuggable.
    console.error(
      `ErrorBoundary caught an error in ${this.props.label ?? "the app"}:`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = (): void => {
    if (this.props.label) {
      // Section boundary: re-mount the children and try again.
      this.setState({ hasError: false });
    } else {
      // App-level boundary: a full reload is the honest reset.
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex w-full items-center justify-center px-4 py-24">
        <div className="liquid-glass w-full max-w-md rounded-3xl p-8 text-center">
          <p className="text-lg font-semibold tracking-tight text-white">
            Something went wrong loading{" "}
            {this.props.label ?? "this page"}.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            The rest of the site is unaffected. You can try again, and if
            this keeps happening the issue is on our side.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="liquid-glass mt-6 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all duration-500 hover:bg-white/20 hover:shadow-[0_0_24px_rgb(var(--azee-blue)/0.32)] active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
