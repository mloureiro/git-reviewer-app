import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identifies a single focusable diff line.
 * Mirrors the relevant fields from DiffLineData without the content payload.
 */
export interface FocusableLine {
  /** File path this line belongs to. */
  file: string;
  /** Canonical line number (newNumber for insert/context, oldNumber for delete). */
  line: number;
  /** Which column this line belongs to (relevant for side-by-side). */
  side: 'left' | 'right';
}

export interface UseLineFocusResult {
  /**
   * The currently focused line, or `null` when no line is focused.
   * Pass this to DiffView so the correct row receives a visual highlight.
   */
  focusedLine: FocusableLine | null;
  /** Move focus to the next diff line. Auto-advances to the next file at boundaries. */
  focusLineNext: () => void;
  /** Move focus to the previous diff line. Auto-advances to the previous file at boundaries. */
  focusLinePrev: () => void;
  /** Clear line focus (e.g. on Escape). */
  clearLineFocus: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Tracks keyboard-level focus on individual diff lines across all files.
 *
 * `focusLineNext` / `focusLinePrev` advance a flat index through the provided
 * `lines` array. When the index crosses a file boundary the optional
 * `onFileBoundary` callback is invoked with the new file path so the caller
 * can sync file-level focus (e.g. useFileFocus) and scroll the file section
 * into view.
 *
 * The focused row receives a `data-line-focused` attribute via DiffView
 * props, and the hook scrolls that row into view on each transition.
 *
 * @param lines   Flat, ordered list of all focusable diff lines.
 * @param onFileBoundary  Called whenever the focused file changes so the
 *   parent can sync file-level focus and scroll the section header.
 */
export function useLineFocus(
  lines: FocusableLine[],
  onFileBoundary?: (filePath: string) => void,
): UseLineFocusResult {
  // Keep refs so callbacks never go stale without being re-created.
  const linesRef = useRef<FocusableLine[]>(lines);
  linesRef.current = lines;

  const onFileBoundaryRef = useRef(onFileBoundary);
  onFileBoundaryRef.current = onFileBoundary;

  // -1 means nothing focused.
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const focusedIndexRef = useRef<number>(-1);
  focusedIndexRef.current = focusedIndex;

  /** Scroll the DOM row for the given line into view. */
  const scrollToLine = useCallback((entry: FocusableLine): void => {
    // The DiffLineRow renders a <tr> with data-file-path / data-line-number /
    // data-line-side attributes that we use to locate the element.
    const selector = `tr[data-file-path="${CSS.escape(entry.file)}"][data-line-number="${entry.line}"][data-line-side="${entry.side}"]`;
    const el = document.querySelector<HTMLElement>(selector);
    if (el != null) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  /** Apply focus to index, fire boundary callback if the file changed. */
  const applyIndex = useCallback(
    (nextIndex: number): void => {
      const allLines = linesRef.current;
      const nextEntry = allLines[nextIndex];
      if (nextEntry == null) return;

      const prevEntry = allLines[focusedIndexRef.current];
      const fileChanged = prevEntry == null || prevEntry.file !== nextEntry.file;

      setFocusedIndex(nextIndex);
      focusedIndexRef.current = nextIndex;
      scrollToLine(nextEntry);

      if (fileChanged && onFileBoundaryRef.current != null) {
        onFileBoundaryRef.current(nextEntry.file);
      }
    },
    [scrollToLine],
  );

  const focusLineNext = useCallback((): void => {
    const allLines = linesRef.current;
    if (allLines.length === 0) return;

    const current = focusedIndexRef.current;
    // When nothing is focused, start at the first line.
    const next = current === -1 ? 0 : Math.min(current + 1, allLines.length - 1);

    // If already at the last line, do nothing (no wrap).
    if (current !== -1 && current === allLines.length - 1) return;

    applyIndex(next);
  }, [applyIndex]);

  const focusLinePrev = useCallback((): void => {
    const allLines = linesRef.current;
    if (allLines.length === 0) return;

    const current = focusedIndexRef.current;
    // When nothing is focused, start at the last line.
    const prev = current === -1 ? allLines.length - 1 : Math.max(current - 1, 0);

    // If already at the first line, do nothing (no wrap).
    if (current === 0) return;

    applyIndex(prev);
  }, [applyIndex]);

  const clearLineFocus = useCallback((): void => {
    setFocusedIndex(-1);
    focusedIndexRef.current = -1;
  }, []);

  const focusedLine =
    focusedIndex >= 0 && focusedIndex < lines.length ? (lines[focusedIndex] ?? null) : null;

  return { focusedLine, focusLineNext, focusLinePrev, clearLineFocus };
}
