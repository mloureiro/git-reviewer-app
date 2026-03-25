import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FocusableLine } from './useLineFocus';
import { useLineFocus } from './useLineFocus';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LINE_A1: FocusableLine = { file: 'a.ts', line: 1, side: 'right' };
const LINE_A2: FocusableLine = { file: 'a.ts', line: 2, side: 'right' };
const LINE_A3: FocusableLine = { file: 'a.ts', line: 3, side: 'left' };
const LINE_B1: FocusableLine = { file: 'b.ts', line: 1, side: 'right' };
const LINE_B2: FocusableLine = { file: 'b.ts', line: 2, side: 'right' };

const ALL_LINES = [LINE_A1, LINE_A2, LINE_A3, LINE_B1, LINE_B2];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScrollTarget(): HTMLElement {
  return { scrollIntoView: vi.fn() } as unknown as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLineFocus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts with no line focused (focusedLine is null)', () => {
    const { result } = renderHook(() => useLineFocus(ALL_LINES));
    expect(result.current.focusedLine).toBeNull();
  });

  it('returns null focusedLine when lines is empty', () => {
    const { result } = renderHook(() => useLineFocus([]));
    expect(result.current.focusedLine).toBeNull();
  });

  // -------------------------------------------------------------------------
  // focusLineNext
  // -------------------------------------------------------------------------

  it('focusLineNext focuses the first line when nothing is focused', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => {
      result.current.focusLineNext();
    });

    expect(result.current.focusedLine).toEqual(LINE_A1);
  });

  it('focusLineNext advances to subsequent lines', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => {
      result.current.focusLineNext(); // → LINE_A1
    });
    act(() => {
      result.current.focusLineNext(); // → LINE_A2
    });
    act(() => {
      result.current.focusLineNext(); // → LINE_A3
    });

    expect(result.current.focusedLine).toEqual(LINE_A3);
  });

  it('focusLineNext crosses file boundary to the next file', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    // Advance to LINE_A3 (last line of a.ts)
    act(() => result.current.focusLineNext()); // LINE_A1
    act(() => result.current.focusLineNext()); // LINE_A2
    act(() => result.current.focusLineNext()); // LINE_A3
    // Cross boundary into b.ts
    act(() => result.current.focusLineNext()); // LINE_B1

    expect(result.current.focusedLine).toEqual(LINE_B1);
  });

  it('focusLineNext stops at the last line (no wrap)', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    // Advance to the very last line
    for (let i = 0; i < ALL_LINES.length; i = i + 1) {
      act(() => result.current.focusLineNext());
    }

    // One more press should not move
    act(() => result.current.focusLineNext());

    expect(result.current.focusedLine).toEqual(LINE_B2);
  });

  it('focusLineNext is a no-op when lines is empty', () => {
    const { result } = renderHook(() => useLineFocus([]));

    act(() => {
      result.current.focusLineNext();
    });

    expect(result.current.focusedLine).toBeNull();
  });

  // -------------------------------------------------------------------------
  // focusLinePrev
  // -------------------------------------------------------------------------

  it('focusLinePrev focuses the last line when nothing is focused', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => {
      result.current.focusLinePrev();
    });

    expect(result.current.focusedLine).toEqual(LINE_B2);
  });

  it('focusLinePrev moves backward through lines', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => result.current.focusLinePrev()); // LINE_B2
    act(() => result.current.focusLinePrev()); // LINE_B1

    expect(result.current.focusedLine).toEqual(LINE_B1);
  });

  it('focusLinePrev crosses file boundary to the previous file', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => result.current.focusLinePrev()); // LINE_B2
    act(() => result.current.focusLinePrev()); // LINE_B1
    act(() => result.current.focusLinePrev()); // LINE_A3 (back in a.ts)

    expect(result.current.focusedLine).toEqual(LINE_A3);
  });

  it('focusLinePrev stops at the first line (no wrap)', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    // Go to first line first
    act(() => result.current.focusLineNext()); // LINE_A1

    // Now try to go back
    act(() => result.current.focusLinePrev()); // Should stay at LINE_A1

    expect(result.current.focusedLine).toEqual(LINE_A1);
  });

  it('focusLinePrev is a no-op when lines is empty', () => {
    const { result } = renderHook(() => useLineFocus([]));

    act(() => {
      result.current.focusLinePrev();
    });

    expect(result.current.focusedLine).toBeNull();
  });

  // -------------------------------------------------------------------------
  // clearLineFocus
  // -------------------------------------------------------------------------

  it('clearLineFocus resets focusedLine to null', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => result.current.focusLineNext());
    expect(result.current.focusedLine).toEqual(LINE_A1);

    act(() => result.current.clearLineFocus());
    expect(result.current.focusedLine).toBeNull();
  });

  it('clearLineFocus makes the next focusLineNext restart from the first line', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => result.current.focusLineNext()); // LINE_A1
    act(() => result.current.focusLineNext()); // LINE_A2
    act(() => result.current.clearLineFocus()); // null
    act(() => result.current.focusLineNext()); // back to LINE_A1

    expect(result.current.focusedLine).toEqual(LINE_A1);
  });

  // -------------------------------------------------------------------------
  // onFileBoundary callback
  // -------------------------------------------------------------------------

  it('fires onFileBoundary when focus crosses into a new file', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const onFileBoundary = vi.fn();
    const { result } = renderHook(() => useLineFocus(ALL_LINES, onFileBoundary));

    act(() => result.current.focusLineNext()); // LINE_A1 (first focus, file changes from null)

    expect(onFileBoundary).toHaveBeenCalledWith('a.ts');
  });

  it('fires onFileBoundary when advancing from last line of one file to first of next', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const onFileBoundary = vi.fn();
    const { result } = renderHook(() => useLineFocus(ALL_LINES, onFileBoundary));

    act(() => result.current.focusLineNext()); // LINE_A1
    act(() => result.current.focusLineNext()); // LINE_A2
    act(() => result.current.focusLineNext()); // LINE_A3
    onFileBoundary.mockClear();

    act(() => result.current.focusLineNext()); // LINE_B1 → boundary

    expect(onFileBoundary).toHaveBeenCalledWith('b.ts');
    expect(onFileBoundary).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onFileBoundary when staying within the same file', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(makeScrollTarget());
    const onFileBoundary = vi.fn();
    const { result } = renderHook(() => useLineFocus(ALL_LINES, onFileBoundary));

    act(() => result.current.focusLineNext()); // LINE_A1
    onFileBoundary.mockClear();

    act(() => result.current.focusLineNext()); // LINE_A2 (same file)

    expect(onFileBoundary).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // scrollIntoView
  // -------------------------------------------------------------------------

  it('calls scrollIntoView on the focused row element', () => {
    const el = makeScrollTarget();
    vi.spyOn(document, 'querySelector').mockReturnValue(el);
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    act(() => result.current.focusLineNext());

    expect(el.scrollIntoView as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
  });

  it('does not throw when the row element is not found in DOM', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(null);
    const { result } = renderHook(() => useLineFocus(ALL_LINES));

    expect(() => {
      act(() => result.current.focusLineNext());
    }).not.toThrow();
  });
});
