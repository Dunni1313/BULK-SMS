// Phase 9 — Production Readiness. A top-level React error boundary: if
// any page component throws during render, this catches it and shows a
// recoverable fallback instead of a blank white screen. Purely additive
// UI resilience — it never intercepts anything when no error occurs
// (children render exactly as before), and it contains no business logic
// of its own. Error boundaries must be class components; there is no
// hook equivalent in React today.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error caught by ErrorBoundary:", error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6" data-testid="error-boundary-fallback">
          <div className="max-w-md space-y-4 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              This page hit an unexpected error. Your data is safe — nothing was submitted or changed.
              Reloading usually resolves this.
            </p>
            <Button onClick={this.handleReload} data-testid="error-boundary-reload">
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
