import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button.js';
import './ErrorBoundary.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** Content to render when no error is present. */
  children: ReactNode;
  /**
   * Optional custom fallback. Receives the caught error and a reset callback.
   * When omitted the built-in `ErrorFallback` is rendered.
   */
  fallback?: (error: Error, onReset: () => void) => ReactNode;
  /**
   * Optional label used in the fallback UI heading for context.
   * e.g. "diff view" renders "Something went wrong in the diff view."
   */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Built-in fallback UI
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  error: Error;
  label?: string;
  onReset: () => void;
}

function ErrorFallback({ error, label, onReset }: ErrorFallbackProps) {
  const heading = label != null ? `Something went wrong in the ${label}.` : 'Something went wrong.';

  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary__icon" aria-hidden="true">
        &#9888;
      </div>
      <h2 className="error-boundary__heading">{heading}</h2>
      <p className="error-boundary__message">{error.message}</p>
      <Button variant="secondary" size="sm" onClick={onReset}>
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console so devs can see the full stack in the browser console.
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset(): void {
    this.setState({ error: null });
  }

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback, label } = this.props;

    if (error != null) {
      if (fallback != null) {
        return fallback(error, this.handleReset);
      }
      return <ErrorFallback error={error} label={label} onReset={this.handleReset} />;
    }

    return children;
  }
}
