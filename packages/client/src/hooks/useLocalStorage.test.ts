import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

// ---------------------------------------------------------------------------
// localStorage mock helpers
// ---------------------------------------------------------------------------

function mockStorage(): Record<string, string> {
  const store: Record<string, string> = {};

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    store[key] = value;
  });

  return store;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // Initial value
  // -------------------------------------------------------------------------

  it('returns the initial value when localStorage has no entry for the key', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns the stored value when localStorage already has an entry', () => {
    localStorage.setItem('test-key', JSON.stringify('persisted'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('persisted');
  });

  it('works with non-string generic types (number)', () => {
    localStorage.setItem('count', JSON.stringify(42));
    const { result } = renderHook(() => useLocalStorage('count', 0));
    expect(result.current[0]).toBe(42);
  });

  it('works with non-string generic types (object)', () => {
    const stored = { theme: 'dark', size: 14 };
    localStorage.setItem('prefs', JSON.stringify(stored));
    const { result } = renderHook(() => useLocalStorage('prefs', { theme: 'light', size: 12 }));
    expect(result.current[0]).toEqual(stored);
  });

  // -------------------------------------------------------------------------
  // Fallback on parse error
  // -------------------------------------------------------------------------

  it('falls back to the initial value when the stored JSON is invalid', () => {
    const store = mockStorage();
    store['bad-key'] = 'not valid json {{{';

    const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  // -------------------------------------------------------------------------
  // Persistence on change
  // -------------------------------------------------------------------------

  it('writes the new value to localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('persists across hook re-mounts by reading localStorage', () => {
    const { unmount } = renderHook(() => useLocalStorage('persist-key', 'first'));

    // Update the value while the first instance is mounted
    const { result: firstResult } = renderHook(() => useLocalStorage('persist-key', 'first'));
    act(() => {
      firstResult.current[1]('second');
    });
    unmount();

    // Second mount should read the persisted value
    const { result: secondResult } = renderHook(() => useLocalStorage('persist-key', 'first'));
    expect(secondResult.current[0]).toBe('second');
  });

  // -------------------------------------------------------------------------
  // Graceful write error handling
  // -------------------------------------------------------------------------

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'value'));

    expect(() => {
      act(() => {
        result.current[1]('new-value');
      });
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Stable setter reference
  // -------------------------------------------------------------------------

  it('returns the same setValue reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useLocalStorage('test-key', 0));

    const firstSetter = result.current[1];
    rerender();
    expect(result.current[1]).toBe(firstSetter);
  });
});
