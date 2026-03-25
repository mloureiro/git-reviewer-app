import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTheme } from './useTheme';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTheme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  // -------------------------------------------------------------------------
  // Default theme
  // -------------------------------------------------------------------------

  it('defaults to "dark" when localStorage has no stored theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  // -------------------------------------------------------------------------
  // Reads from localStorage
  // -------------------------------------------------------------------------

  it('reads "light" theme from localStorage when stored', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('reads "dark" theme from localStorage when stored', () => {
    localStorage.setItem('theme', JSON.stringify('dark'));
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  // -------------------------------------------------------------------------
  // data-theme attribute on document.documentElement
  // -------------------------------------------------------------------------

  it('sets data-theme to "dark" on mount when no theme is stored', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme to "light" on mount when "light" is stored', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates data-theme attribute when theme changes', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  // -------------------------------------------------------------------------
  // toggleTheme
  // -------------------------------------------------------------------------

  it('toggles from "dark" to "light"', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
  });

  it('toggles from "light" back to "dark"', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
  });

  it('toggles back and forth multiple times correctly', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });

  // -------------------------------------------------------------------------
  // localStorage persistence on theme change
  // -------------------------------------------------------------------------

  it('writes the new theme to localStorage when toggleTheme is called', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('theme')).toBe(JSON.stringify('light'));
  });

  it('persists "dark" to localStorage after toggling back from "light"', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('theme')).toBe(JSON.stringify('dark'));
  });
});
