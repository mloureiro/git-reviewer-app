import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// ---------------------------------------------------------------------------
// Helper — a component that throws on demand
// ---------------------------------------------------------------------------

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Boom! Something exploded.');
  }
  return <div>All good</div>;
}

// Suppress React's error boundary console output in tests so the test output
// stays clean. React calls console.error twice for caught errors.
const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

function suppressErrorOutput() {
  console.error = vi.fn();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the default fallback UI when a child throws', () => {
    suppressErrorOutput();

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('Boom! Something exploded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('includes the label in the fallback heading when provided', () => {
    suppressErrorOutput();

    render(
      <ErrorBoundary label="diff view">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong in the diff view.')).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    suppressErrorOutput();

    render(
      <ErrorBoundary fallback={(error) => <div>Custom: {error.message}</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom: Boom! Something exploded.')).toBeInTheDocument();
  });

  it('resets back to children when the retry button is clicked', () => {
    suppressErrorOutput();

    // Use a stateful parent that stops throwing after the boundary resets.
    // The parent tracks a `shouldThrow` flag. After clicking "Try again",
    // the boundary clears its error state and re-renders children. We need
    // the children to NOT throw on that re-render, so the parent must already
    // have `shouldThrow=false` by then. We arrange this by updating state
    // via the custom fallback's reset callback.
    function ControlledWrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      function customFallback(_error: Error, onReset: () => void) {
        return (
          <button
            type="button"
            onClick={() => {
              setShouldThrow(false);
              onReset();
            }}
          >
            Try again
          </button>
        );
      }

      return (
        <ErrorBoundary fallback={customFallback}>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<ControlledWrapper />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    // Click resets shouldThrow=false AND clears boundary error — children render.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('passes a reset callback to the custom fallback', () => {
    suppressErrorOutput();

    const resetSpy = vi.fn();
    let capturedReset: (() => void) | null = null;

    render(
      <ErrorBoundary
        fallback={(error, onReset) => {
          capturedReset = onReset;
          return (
            <button
              type="button"
              onClick={() => {
                resetSpy();
                onReset();
              }}
            >
              reset: {error.message}
            </button>
          );
        }}
      >
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(capturedReset).not.toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(resetSpy).toHaveBeenCalledOnce();
  });
});
