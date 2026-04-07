import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SearchBar } from './SearchBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 80;

function renderOpen(overrides: Partial<React.ComponentProps<typeof SearchBar>> = {}) {
  const props: React.ComponentProps<typeof SearchBar> = {
    isOpen: true,
    onQueryChange: vi.fn(),
    matchCount: 0,
    currentMatchIndex: 0,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<SearchBar {...props} />), props };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchBar', () => {
  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  describe('when isOpen is false', () => {
    it('renders nothing', () => {
      const { container } = render(
        <SearchBar
          isOpen={false}
          onQueryChange={vi.fn()}
          matchCount={0}
          currentMatchIndex={0}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('when isOpen is true', () => {
    it('renders the search input', () => {
      renderOpen();

      expect(screen.getByRole('textbox', { name: 'Search diff content' })).toBeInTheDocument();
    });

    it('search input has the correct aria-label', () => {
      renderOpen();

      expect(screen.getByRole('textbox', { name: 'Search diff content' })).toBeInTheDocument();
    });

    it('renders the previous match button', () => {
      renderOpen();

      expect(screen.getByRole('button', { name: 'Previous match' })).toBeInTheDocument();
    });

    it('renders the next match button', () => {
      renderOpen();

      expect(screen.getByRole('button', { name: 'Next match' })).toBeInTheDocument();
    });

    it('renders the close button', () => {
      renderOpen();

      expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument();
    });

    it('renders the search landmark region', () => {
      renderOpen();

      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('input starts empty', () => {
      renderOpen();

      const input = screen.getByRole('textbox', {
        name: 'Search diff content',
      }) as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Match count display
  // -------------------------------------------------------------------------

  describe('match count label', () => {
    it('does not show a count label when input is empty', () => {
      renderOpen({ matchCount: 3, currentMatchIndex: 0 });

      // No count text visible when query is empty
      expect(screen.queryByText(/of \d+/)).toBeNull();
    });

    it('shows "No results" when there are no matches', () => {
      renderOpen({ matchCount: 0, currentMatchIndex: 0 });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'xyz' },
      });

      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('shows "current of total" when there are matches', () => {
      renderOpen({ matchCount: 5, currentMatchIndex: 2 });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'foo' },
      });

      expect(screen.getByText('3 of 5')).toBeInTheDocument();
    });

    it('shows "1 of N" when currentMatchIndex is 0', () => {
      renderOpen({ matchCount: 4, currentMatchIndex: 0 });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'bar' },
      });

      expect(screen.getByText('1 of 4')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Nav buttons disabled state
  // -------------------------------------------------------------------------

  describe('navigation buttons disabled state', () => {
    it('previous match button is disabled when matchCount is 0', () => {
      renderOpen({ matchCount: 0 });

      expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    });

    it('next match button is disabled when matchCount is 0', () => {
      renderOpen({ matchCount: 0 });

      expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
    });

    it('previous match button is enabled when matchCount > 0', () => {
      renderOpen({ matchCount: 3, currentMatchIndex: 0 });

      expect(screen.getByRole('button', { name: 'Previous match' })).not.toBeDisabled();
    });

    it('next match button is enabled when matchCount > 0', () => {
      renderOpen({ matchCount: 3, currentMatchIndex: 0 });

      expect(screen.getByRole('button', { name: 'Next match' })).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Button click interactions
  // -------------------------------------------------------------------------

  describe('clicking navigation buttons', () => {
    it('clicking "Next match" button calls onNext', () => {
      const onNext = vi.fn();
      renderOpen({ matchCount: 3, onNext });

      fireEvent.click(screen.getByRole('button', { name: 'Next match' }));

      expect(onNext).toHaveBeenCalledOnce();
    });

    it('clicking "Previous match" button calls onPrev', () => {
      const onPrev = vi.fn();
      renderOpen({ matchCount: 3, onPrev });

      fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));

      expect(onPrev).toHaveBeenCalledOnce();
    });

    it('clicking "Close search" button calls onClose', () => {
      const onClose = vi.fn();
      renderOpen({ onClose });

      fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Keyboard interactions
  // -------------------------------------------------------------------------

  describe('keyboard interactions', () => {
    it('pressing Escape calls onClose', () => {
      const onClose = vi.fn();
      renderOpen({ onClose });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'Escape',
      });

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('pressing Enter calls onNext', () => {
      const onNext = vi.fn();
      renderOpen({ onNext });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'Enter',
      });

      expect(onNext).toHaveBeenCalledOnce();
    });

    it('pressing Shift+Enter calls onPrev', () => {
      const onPrev = vi.fn();
      renderOpen({ onPrev });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'Enter',
        shiftKey: true,
      });

      expect(onPrev).toHaveBeenCalledOnce();
    });

    it('pressing Shift+Enter does not call onNext', () => {
      const onNext = vi.fn();
      renderOpen({ onNext });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'Enter',
        shiftKey: true,
      });

      expect(onNext).not.toHaveBeenCalled();
    });

    it('pressing ArrowDown calls onNext', () => {
      const onNext = vi.fn();
      renderOpen({ onNext });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'ArrowDown',
      });

      expect(onNext).toHaveBeenCalledOnce();
    });

    it('pressing ArrowUp calls onPrev', () => {
      const onPrev = vi.fn();
      renderOpen({ onPrev });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'ArrowUp',
      });

      expect(onPrev).toHaveBeenCalledOnce();
    });

    it('pressing an unhandled key does not call any handler', () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const onClose = vi.fn();
      renderOpen({ onNext, onPrev, onClose });

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), { key: 'a' });

      expect(onNext).not.toHaveBeenCalled();
      expect(onPrev).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Debounced query propagation
  // -------------------------------------------------------------------------

  describe('debounced query propagation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('updates local value immediately on typing', () => {
      renderOpen();

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'hello' },
      });

      const input = screen.getByRole('textbox', {
        name: 'Search diff content',
      }) as HTMLInputElement;
      expect(input.value).toBe('hello');
    });

    it('does not call onQueryChange before debounce delay', () => {
      const onQueryChange = vi.fn();
      renderOpen({ onQueryChange });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'hello' },
      });

      // Advance time but not enough to trigger debounce
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS - 1);
      });

      expect(onQueryChange).not.toHaveBeenCalled();
    });

    it('calls onQueryChange after debounce delay', () => {
      const onQueryChange = vi.fn();
      renderOpen({ onQueryChange });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'hello' },
      });

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(onQueryChange).toHaveBeenCalledOnce();
      expect(onQueryChange).toHaveBeenCalledWith('hello');
    });

    it('debounces multiple rapid changes and only fires once', () => {
      const onQueryChange = vi.fn();
      renderOpen({ onQueryChange });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'h' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'he' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'hel' },
      });

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });

      expect(onQueryChange).toHaveBeenCalledOnce();
      expect(onQueryChange).toHaveBeenCalledWith('hel');
    });

    it('pressing Enter flushes pending debounce immediately and calls onQueryChange + onNext', () => {
      const onQueryChange = vi.fn();
      const onNext = vi.fn();
      renderOpen({ onQueryChange, onNext });

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'hello' },
      });

      // Press Enter before debounce fires
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search diff content' }), {
        key: 'Enter',
      });

      // onQueryChange should be called synchronously via the flush in handleKeyDown
      expect(onQueryChange).toHaveBeenCalledWith('hello');
      expect(onNext).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Clearing state when closed
  // -------------------------------------------------------------------------

  describe('clearing state when closed', () => {
    it('resets local input value when isOpen changes to false', () => {
      const { rerender } = render(
        <SearchBar
          isOpen={true}
          onQueryChange={vi.fn()}
          matchCount={0}
          currentMatchIndex={0}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByRole('textbox', { name: 'Search diff content' }), {
        target: { value: 'some text' },
      });

      rerender(
        <SearchBar
          isOpen={false}
          onQueryChange={vi.fn()}
          matchCount={0}
          currentMatchIndex={0}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      // Re-open
      rerender(
        <SearchBar
          isOpen={true}
          onQueryChange={vi.fn()}
          matchCount={0}
          currentMatchIndex={0}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const input = screen.getByRole('textbox', {
        name: 'Search diff content',
      }) as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });
});
