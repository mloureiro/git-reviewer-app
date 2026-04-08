import { useEffect } from 'react';
import type { ShortcutEntry } from '../hooks/useKeyboardShortcuts';
import { IconButton } from './ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShortcutsHelpModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;
  /** Called when the modal should be closed (backdrop click or Escape). */
  onClose: () => void;
  /** List of shortcut entries to display, sourced from useKeyboardShortcuts. */
  shortcuts: ShortcutEntry[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Centered overlay listing all registered keyboard shortcuts.
 * Toggled by pressing `?` and closed by pressing `Escape` or clicking the backdrop.
 */
export function ShortcutsHelpModal({
  isOpen,
  onClose,
  shortcuts,
}: ShortcutsHelpModalProps): React.ReactNode {
  // Close when Escape or '?' is pressed while the modal is open.
  // The shortcut registry is disabled while the modal is open (enabled=false), so
  // we wire these keys directly here so the modal can close itself independently.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' || event.key === '?') {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-modal-backdrop" role="presentation" onClick={onClose}>
      <dialog
        className="shortcuts-modal"
        open
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-modal__header">
          <h2 className="shortcuts-modal__title">Keyboard shortcuts</h2>
          <IconButton size="md" aria-label="Close shortcuts" onClick={onClose}>
            ✕
          </IconButton>
        </div>

        <table className="shortcuts-modal__table">
          <tbody>
            {shortcuts.map(({ key, description, meta }) => (
              <tr key={`${meta ? 'meta-' : ''}${key}`} className="shortcuts-modal__row">
                <td className="shortcuts-modal__key-cell">
                  {meta && (
                    <kbd className="shortcuts-modal__kbd">
                      {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}
                    </kbd>
                  )}
                  <kbd className="shortcuts-modal__kbd">{key === 'Escape' ? 'Esc' : key}</kbd>
                </td>
                <td className="shortcuts-modal__desc-cell">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </dialog>
    </div>
  );
}
