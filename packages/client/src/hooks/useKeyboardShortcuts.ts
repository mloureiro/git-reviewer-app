import { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutDescriptor {
  /** The key this shortcut listens for (e.g. 'n', 'p', 'j', 'k', 'c', '?', 'Escape'). */
  key: string;
  /** Human-readable description shown in the help modal. */
  description: string;
  /** The handler called when the key is pressed. */
  handler: () => void;
  /** When true, requires Cmd (Mac) or Ctrl (Windows/Linux) to be held. */
  meta?: boolean;
}

export interface ShortcutEntry {
  /** The key this shortcut listens for. */
  key: string;
  /** Human-readable description for display in the help modal. */
  description: string;
  /** When true, this shortcut requires Cmd/Ctrl. */
  meta?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the keyboard event originates from an element where
 * typing is expected — input, textarea, select, or contenteditable.
 * In those cases shortcuts must be suppressed to avoid interfering with user input.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registry-pattern keyboard shortcut hook.
 *
 * Accepts a list of `ShortcutDescriptor` objects, attaches a single global
 * `keydown` listener, and dispatches to the matching handler. Shortcuts are
 * suppressed when focus is on a form element (input, textarea, select,
 * contenteditable).
 *
 * Returns a stable array of `ShortcutEntry` objects (key + description) that
 * can be consumed by a help modal (step 9.5).
 *
 * @param shortcuts - Array of shortcut descriptors. The array identity may
 *   change on every render; handlers are read from a ref so they are always
 *   current without re-registering the DOM listener.
 * @param enabled - When `false` all shortcuts are suppressed (e.g. during a
 *   modal or form interaction). Defaults to `true`.
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDescriptor[],
  enabled = true,
): ShortcutEntry[] {
  // Keep a stable ref to the latest shortcuts array so the effect closure
  // always calls the current handler without needing to re-run the effect.
  const shortcutsRef = useRef<ShortcutDescriptor[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabledRef.current) return;

    const hasMeta = event.metaKey || event.ctrlKey;

    const match = shortcutsRef.current.find((s) => {
      if (s.key !== event.key) return false;
      if (s.meta) return hasMeta;
      // Plain shortcuts require no modifiers and must not fire on typing targets
      return !hasMeta && !event.altKey;
    });
    if (match == null) return;

    // Plain (non-meta) shortcuts are suppressed on typing targets
    if (!match.meta && isTypingTarget(event.target)) return;

    event.preventDefault();
    match.handler();
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Build the descriptions array. We derive it from the shortcuts prop directly
  // (not the ref) so React can memoize it — callers can wrap `shortcuts` in
  // useMemo if they want a stable reference.
  return shortcuts.map(({ key, description, meta }) => ({ key, description, meta }));
}
