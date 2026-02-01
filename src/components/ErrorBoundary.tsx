import { Component, ErrorInfo, ReactNode } from "react";
import { log } from "../lib/log";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch React errors and prevent black screen crashes
 * 
 * Wraps the app to catch rendering errors and display a fallback UI instead of
 * crashing the entire application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error in dev mode (redacted to prevent PII exposure)
    log.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-bg p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center shadow-neon-sm">
            <h1 className="mb-4 text-2xl font-bold text-text">Something went wrong</h1>
            <p className="mb-6 text-text/70">
              We encountered an unexpected error. Please try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left">
                <p className="mb-2 text-sm font-semibold text-red-400">Error details (dev only):</p>
                <pre className="max-h-40 overflow-auto text-xs text-red-300">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
