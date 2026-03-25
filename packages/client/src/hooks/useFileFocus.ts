import { useCallback, useRef, useState } from 'react';
import { filePathToId } from '../components/DiffView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFileFocusResult {
  /** The file path that is currently keyboard-focused, or `null` if none. */
  focusedFilePath: string | null;
  /** Move focus to the next file (wraps around). No-op when `filePaths` is empty. */
  focusNext: () => void;
  /** Move focus to the previous file (wraps around). No-op when `filePaths` is empty. */
  focusPrev: () => void;
  /** Clear focus (e.g. on Escape). */
  clearFocus: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Tracks keyboard-level focus across the rendered diff file sections.
 *
 * `focusNext` / `focusPrev` advance the focused index through `filePaths`,
 * scrolling the corresponding `.diff-file-section` element into view each
 * time. The focused section receives the `diff-file-section--focused` CSS
 * class (applied via a `focusedFilePath` return value that the DiffView can
 * read).
 *
 * Focus starts at `null` (no file focused). The first call to `focusNext`
 * focuses the first file; the first call to `focusPrev` focuses the last.
 *
 * @param filePaths - ordered list of file paths currently rendered in the diff
 */
export function useFileFocus(filePaths: string[]): UseFileFocusResult {
  // Use a ref for the paths array so scroll logic always sees the latest list
  // without needing to re-create callbacks.
  const filePathsRef = useRef<string[]>(filePaths);
  filePathsRef.current = filePaths;

  // Focused index: -1 means nothing is focused.
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Keep a ref in sync so the callbacks can read it without stale-closure issues.
  const focusedIndexRef = useRef<number>(-1);
  focusedIndexRef.current = focusedIndex;

  /** Scroll the section for `filePaths[index]` into view. */
  const scrollToIndex = useCallback((index: number): void => {
    const paths = filePathsRef.current;
    const path = paths[index];
    if (path == null) return;

    const sectionId = filePathToId(path);
    const element = document.getElementById(sectionId);
    if (element != null) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const focusNext = useCallback((): void => {
    const paths = filePathsRef.current;
    if (paths.length === 0) return;

    const current = focusedIndexRef.current;
    const next = current === -1 ? 0 : (current + 1) % paths.length;

    setFocusedIndex(next);
    focusedIndexRef.current = next;
    scrollToIndex(next);
  }, [scrollToIndex]);

  const focusPrev = useCallback((): void => {
    const paths = filePathsRef.current;
    if (paths.length === 0) return;

    const current = focusedIndexRef.current;
    const prev = current === -1 ? paths.length - 1 : (current - 1 + paths.length) % paths.length;

    setFocusedIndex(prev);
    focusedIndexRef.current = prev;
    scrollToIndex(prev);
  }, [scrollToIndex]);

  const clearFocus = useCallback((): void => {
    setFocusedIndex(-1);
    focusedIndexRef.current = -1;
  }, []);

  const focusedFilePath =
    focusedIndex >= 0 && focusedIndex < filePaths.length ? (filePaths[focusedIndex] ?? null) : null;

  return { focusedFilePath, focusNext, focusPrev, clearFocus };
}
