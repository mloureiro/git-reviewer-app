import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import type { ShortcutEntry } from '../hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'n', description: 'Focus next file' },
  { key: 'p', description: 'Focus previous file' },
  { key: 'j', description: 'Focus next diff line' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Escape', description: 'Dismiss / clear focus' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShortcutsHelpModal', () => {
  describe('when isOpen is false', () => {
    it('renders nothing', () => {
      const { container } = render(
        <ShortcutsHelpModal isOpen={false} onClose={vi.fn()} shortcuts={SHORTCUTS} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('when isOpen is true', () => {
    it('renders the modal with the title', () => {
      render(<ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={SHORTCUTS} />);

      expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    });

    it('renders a row for each shortcut', () => {
      render(<ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={SHORTCUTS} />);

      for (const { description } of SHORTCUTS) {
        expect(screen.getByText(description)).toBeInTheDocument();
      }
    });

    it('renders key labels in <kbd> elements', () => {
      const { container } = render(
        <ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={SHORTCUTS} />,
      );

      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBe(SHORTCUTS.length);
    });

    it('displays "Esc" instead of "Escape" for the Escape key', () => {
      render(<ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={SHORTCUTS} />);

      expect(screen.getByText('Esc')).toBeInTheDocument();
      expect(screen.queryByText('Escape')).toBeNull();
    });

    it('calls onClose when the close button is clicked', () => {
      const onClose = vi.fn();
      render(<ShortcutsHelpModal isOpen onClose={onClose} shortcuts={SHORTCUTS} />);

      fireEvent.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when the backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(
        <ShortcutsHelpModal isOpen onClose={onClose} shortcuts={SHORTCUTS} />,
      );

      const backdrop = container.querySelector('.shortcuts-modal-backdrop');
      expect(backdrop).toBeInTheDocument();
      if (backdrop != null) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not call onClose when the modal dialog itself is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(
        <ShortcutsHelpModal isOpen onClose={onClose} shortcuts={SHORTCUTS} />,
      );

      const dialog = container.querySelector('.shortcuts-modal');
      expect(dialog).toBeInTheDocument();
      if (dialog != null) {
        fireEvent.click(dialog);
      }

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<ShortcutsHelpModal isOpen onClose={onClose} shortcuts={SHORTCUTS} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not call onClose when a non-Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<ShortcutsHelpModal isOpen onClose={onClose} shortcuts={SHORTCUTS} />);

      fireEvent.keyDown(window, { key: 'n' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('renders a backdrop element', () => {
      const { container } = render(
        <ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={SHORTCUTS} />,
      );

      expect(container.querySelector('.shortcuts-modal-backdrop')).toBeInTheDocument();
    });

    it('renders an empty table when no shortcuts are passed', () => {
      const { container } = render(<ShortcutsHelpModal isOpen onClose={vi.fn()} shortcuts={[]} />);

      const rows = container.querySelectorAll('.shortcuts-modal__row');
      expect(rows.length).toBe(0);
    });
  });
});
