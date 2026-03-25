import { useEffect } from 'react';
import type { ShortcutEntry } from '../hooks/useKeyboardShortcuts';

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
export function ShortcutsHelpModal({ isOpen, onClose, shortcuts }: ShortcutsHelpModalProps) {
  // Close when Escape is pressed — this fires even while the modal is open because
  // the modal's dialog element is not a form element, so isTypingTarget returns false.
  // However, we wire Escape directly here as well so the modal can close itself
  // independently of the shortcut registry (which may be disabled while open).
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
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
          <button
            className="shortcuts-modal__close"
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <table className="shortcuts-modal__table">
          <tbody>
            {shortcuts.map(({ key, description }) => (
              <tr key={key} className="shortcuts-modal__row">
                <td className="shortcuts-modal__key-cell">
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
