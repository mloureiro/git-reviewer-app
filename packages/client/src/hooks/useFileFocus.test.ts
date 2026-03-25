import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileFocus } from './useFileFocus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stub `document.getElementById` so we can verify scrollIntoView is called
 * without needing a real DOM tree.
 */
function makeElementStub(): { scrollIntoView: ReturnType<typeof vi.fn> } {
  return { scrollIntoView: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFileFocus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts with no file focused (focusedFilePath is null)', () => {
    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts']));
    expect(result.current.focusedFilePath).toBeNull();
  });

  it('returns null focusedFilePath when filePaths is empty', () => {
    const { result } = renderHook(() => useFileFocus([]));
    expect(result.current.focusedFilePath).toBeNull();
  });

  // -------------------------------------------------------------------------
  // focusNext
  // -------------------------------------------------------------------------

  it('focusNext focuses the first file when nothing is focused', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts', 'c.ts']));

    act(() => {
      result.current.focusNext();
    });

    expect(result.current.focusedFilePath).toBe('a.ts');
  });

  it('focusNext advances through subsequent files', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts', 'c.ts']));

    act(() => {
      result.current.focusNext(); // → a.ts
    });
    act(() => {
      result.current.focusNext(); // → b.ts
    });

    expect(result.current.focusedFilePath).toBe('b.ts');
  });

  it('focusNext wraps from last file back to first', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts']));

    act(() => {
      result.current.focusNext(); // → a.ts
    });
    act(() => {
      result.current.focusNext(); // → b.ts
    });
    act(() => {
      result.current.focusNext(); // wraps → a.ts
    });

    expect(result.current.focusedFilePath).toBe('a.ts');
  });

  it('focusNext is a no-op when filePaths is empty', () => {
    const { result } = renderHook(() => useFileFocus([]));

    act(() => {
      result.current.focusNext();
    });

    expect(result.current.focusedFilePath).toBeNull();
  });

  // -------------------------------------------------------------------------
  // focusPrev
  // -------------------------------------------------------------------------

  it('focusPrev focuses the last file when nothing is focused', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts', 'c.ts']));

    act(() => {
      result.current.focusPrev();
    });

    expect(result.current.focusedFilePath).toBe('c.ts');
  });

  it('focusPrev moves backward through files', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts', 'c.ts']));

    act(() => {
      result.current.focusPrev(); // → c.ts
    });
    act(() => {
      result.current.focusPrev(); // → b.ts
    });

    expect(result.current.focusedFilePath).toBe('b.ts');
  });

  it('focusPrev wraps from first file back to last', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts']));

    act(() => {
      result.current.focusNext(); // → a.ts
    });
    act(() => {
      result.current.focusPrev(); // wraps → b.ts
    });

    expect(result.current.focusedFilePath).toBe('b.ts');
  });

  it('focusPrev is a no-op when filePaths is empty', () => {
    const { result } = renderHook(() => useFileFocus([]));

    act(() => {
      result.current.focusPrev();
    });

    expect(result.current.focusedFilePath).toBeNull();
  });

  // -------------------------------------------------------------------------
  // clearFocus
  // -------------------------------------------------------------------------

  it('clearFocus resets focusedFilePath to null', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts']));

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.focusedFilePath).toBe('a.ts');

    act(() => {
      result.current.clearFocus();
    });
    expect(result.current.focusedFilePath).toBeNull();
  });

  it('clearFocus makes the next focusNext restart from the first file', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts', 'b.ts', 'c.ts']));

    act(() => {
      result.current.focusNext(); // → a.ts
    });
    act(() => {
      result.current.focusNext(); // → b.ts
    });
    act(() => {
      result.current.clearFocus(); // → null
    });
    act(() => {
      result.current.focusNext(); // → a.ts again
    });

    expect(result.current.focusedFilePath).toBe('a.ts');
  });

  // -------------------------------------------------------------------------
  // scrollIntoView calls
  // -------------------------------------------------------------------------

  it('calls scrollIntoView on the focused section element', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['a.ts']));

    act(() => {
      result.current.focusNext();
    });

    expect(stub.scrollIntoView).toHaveBeenCalledOnce();
    expect(stub.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('does not throw when the section element is not found in the DOM', () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    const { result } = renderHook(() => useFileFocus(['a.ts']));

    expect(() => {
      act(() => {
        result.current.focusNext();
      });
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Single-file edge case
  // -------------------------------------------------------------------------

  it('focusNext on a single-file list keeps returning that file (wrap to same)', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['only.ts']));

    act(() => {
      result.current.focusNext(); // → only.ts
    });
    expect(result.current.focusedFilePath).toBe('only.ts');

    act(() => {
      result.current.focusNext(); // wraps → still only.ts
    });
    expect(result.current.focusedFilePath).toBe('only.ts');
  });

  it('focusPrev on a single-file list keeps returning that file (wrap to same)', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result } = renderHook(() => useFileFocus(['only.ts']));

    act(() => {
      result.current.focusPrev(); // → only.ts
    });
    expect(result.current.focusedFilePath).toBe('only.ts');

    act(() => {
      result.current.focusPrev(); // wraps → still only.ts
    });
    expect(result.current.focusedFilePath).toBe('only.ts');
  });

  // -------------------------------------------------------------------------
  // Focus clamp when filePaths shrinks
  // -------------------------------------------------------------------------

  it('returns null focusedFilePath when the focused index is out-of-bounds after filePaths shrinks', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result, rerender } = renderHook(
      ({ paths }: { paths: string[] }) => useFileFocus(paths),
      { initialProps: { paths: ['a.ts', 'b.ts', 'c.ts'] } },
    );

    // Focus last file (index 2)
    act(() => result.current.focusNext()); // → a.ts (0)
    act(() => result.current.focusNext()); // → b.ts (1)
    act(() => result.current.focusNext()); // → c.ts (2)
    expect(result.current.focusedFilePath).toBe('c.ts');

    // Shrink list so index 2 is out-of-bounds
    rerender({ paths: ['a.ts'] });

    // focusedFilePath should be null (bounds check in hook)
    expect(result.current.focusedFilePath).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Dynamic filePaths list
  // -------------------------------------------------------------------------

  it('reflects an updated filePaths list on the next navigation', () => {
    const stub = makeElementStub();
    vi.spyOn(document, 'getElementById').mockReturnValue(stub as unknown as HTMLElement);

    const { result, rerender } = renderHook(
      ({ paths }: { paths: string[] }) => useFileFocus(paths),
      {
        initialProps: { paths: ['a.ts', 'b.ts'] },
      },
    );

    // Focus first file
    act(() => {
      result.current.focusNext(); // → a.ts
    });
    expect(result.current.focusedFilePath).toBe('a.ts');

    // Swap in a new list
    rerender({ paths: ['x.ts', 'y.ts', 'z.ts'] });

    act(() => {
      result.current.focusNext(); // current index=0, next=1 → y.ts
    });
    expect(result.current.focusedFilePath).toBe('y.ts');
  });
});
