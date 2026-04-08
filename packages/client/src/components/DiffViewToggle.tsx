import React from 'react';
import type { DiffViewMode } from '../types/review';

interface DiffViewToggleProps {
  mode: DiffViewMode;
  onChange: (mode: DiffViewMode) => void;
}

/**
 * Button group that switches between line-by-line and side-by-side diff modes.
 */
export function DiffViewToggle({ mode, onChange }: DiffViewToggleProps): React.ReactNode {
  return (
    <div className="diff-view-toggle" role="group" aria-label="Diff view mode">
      <button
        type="button"
        className={[
          'diff-view-toggle__btn',
          mode === 'line-by-line' ? 'diff-view-toggle__btn--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('line-by-line')}
        aria-pressed={mode === 'line-by-line'}
      >
        Line by line
      </button>
      <button
        type="button"
        className={[
          'diff-view-toggle__btn',
          mode === 'side-by-side' ? 'diff-view-toggle__btn--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('side-by-side')}
        aria-pressed={mode === 'side-by-side'}
      >
        Side by side
      </button>
    </div>
  );
}
