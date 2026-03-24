import { useEffect } from 'react';
import type { DiffViewMode } from '../types/review';

/**
 * Minimum viewport width (px) required for a comfortable side-by-side view.
 * Below this threshold the view mode is automatically overridden to
 * `line-by-line` regardless of the user's stored preference.
 */
const SBS_MIN_WIDTH = 900;

/**
 * Watches the viewport width and calls `onChange('line-by-line')` when the
 * screen becomes too narrow for side-by-side mode, and restores the user's
 * `preferredMode` when the screen widens again.
 *
 * This does NOT mutate localStorage — it only drives the active runtime mode.
 * The caller keeps the persisted preference separate so it can be restored.
 */
export function useResponsiveDiffMode(
  preferredMode: DiffViewMode,
  activeMode: DiffViewMode,
  onChange: (mode: DiffViewMode) => void,
): void {
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${SBS_MIN_WIDTH - 1}px)`);

    function handleChange(event: MediaQueryListEvent | MediaQueryList): void {
      if (event.matches) {
        // Viewport is narrow — force line-by-line if currently side-by-side.
        if (activeMode === 'side-by-side') {
          onChange('line-by-line');
        }
      } else {
        // Viewport is wide enough — restore the user's stored preference.
        if (activeMode !== preferredMode) {
          onChange(preferredMode);
        }
      }
    }

    // Run immediately to handle the initial state.
    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [preferredMode, activeMode, onChange]);
}
