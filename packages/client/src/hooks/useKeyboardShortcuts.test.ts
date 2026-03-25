import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { ShortcutDescriptor } from './useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKeyDown(key: string, target: EventTarget = window): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'target', { value: target, writable: false });
  window.dispatchEvent(event);
}

function makeInput(tag: 'input' | 'textarea' | 'select' = 'input'): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function makeContentEditable(): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Clean up any elements added to body during tests.
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // Basic dispatch
  // -------------------------------------------------------------------------

  it('calls the matching handler when the registered key is pressed', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('n');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call a handler when an unregistered key is pressed', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('p');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatches to the correct handler among multiple shortcuts', () => {
    const nextHandler = vi.fn();
    const prevHandler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [
      { key: 'n', description: 'Next file', handler: nextHandler },
      { key: 'p', description: 'Previous file', handler: prevHandler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('p');
    });

    expect(prevHandler).toHaveBeenCalledOnce();
    expect(nextHandler).not.toHaveBeenCalled();
  });

  it('handles Escape key', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [
      { key: 'Escape', description: 'Clear focus', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('Escape');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('handles "?" key', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: '?', description: 'Show help', handler }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('?');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Suppression in form elements
  // -------------------------------------------------------------------------

  it('suppresses shortcuts when focus is inside an <input>', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];
    const input = makeInput('input');

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('n', input);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('suppresses shortcuts when focus is inside a <textarea>', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'j', description: 'Next line', handler }];
    const textarea = makeInput('textarea');

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('j', textarea);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('suppresses shortcuts when focus is inside a <select>', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'k', description: 'Prev line', handler }];
    const select = makeInput('select');

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('k', select);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('suppresses shortcuts when focus is inside a contenteditable element', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'c', description: 'Comment', handler }];
    const ce = makeContentEditable();

    renderHook(() => useKeyboardShortcuts(shortcuts));

    act(() => {
      fireKeyDown('c', ce);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // `enabled` flag
  // -------------------------------------------------------------------------

  it('suppresses all shortcuts when enabled=false', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];

    renderHook(() => useKeyboardShortcuts(shortcuts, false));

    act(() => {
      fireKeyDown('n');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatches again when enabled transitions from false to true', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];

    const { rerender } = renderHook(({ enabled }) => useKeyboardShortcuts(shortcuts, enabled), {
      initialProps: { enabled: false },
    });

    act(() => {
      fireKeyDown('n');
    });
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });

    act(() => {
      fireKeyDown('n');
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Handler stability (always calls the latest handler)
  // -------------------------------------------------------------------------

  it('always calls the latest handler after re-render without re-registering listener', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(
      ({ handler }: { handler: () => void }) =>
        useKeyboardShortcuts([{ key: 'n', description: 'Next file', handler }]),
      { initialProps: { handler: firstHandler } },
    );

    rerender({ handler: secondHandler });

    act(() => {
      fireKeyDown('n');
    });

    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Returned descriptions
  // -------------------------------------------------------------------------

  it('returns an array of shortcut entries with key and description', () => {
    const shortcuts: ShortcutDescriptor[] = [
      { key: 'n', description: 'Next file', handler: vi.fn() },
      { key: 'p', description: 'Previous file', handler: vi.fn() },
      { key: '?', description: 'Show help', handler: vi.fn() },
    ];

    const { result } = renderHook(() => useKeyboardShortcuts(shortcuts));

    expect(result.current).toEqual([
      { key: 'n', description: 'Next file' },
      { key: 'p', description: 'Previous file' },
      { key: '?', description: 'Show help' },
    ]);
  });

  it('does not include handler functions in the returned entries', () => {
    const shortcuts: ShortcutDescriptor[] = [
      { key: 'c', description: 'Comment', handler: vi.fn() },
    ];

    const { result } = renderHook(() => useKeyboardShortcuts(shortcuts));

    const entry = result.current[0];
    expect(entry).not.toHaveProperty('handler');
  });

  it('returns an empty array when no shortcuts are registered', () => {
    const { result } = renderHook(() => useKeyboardShortcuts([]));
    expect(result.current).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Listener lifecycle
  // -------------------------------------------------------------------------

  it('removes the keydown listener on unmount', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutDescriptor[] = [{ key: 'n', description: 'Next file', handler }];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    unmount();

    act(() => {
      fireKeyDown('n');
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
