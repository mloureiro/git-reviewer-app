import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTheme } from './useTheme';

const STORAGE_KEY = 'theme-preferences';

function setStoredPrefs(mode: 'dark' | 'light') {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ mode, darkSchemeId: 'github-dark', lightSchemeId: 'github-light' }),
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // Clear inline CSS vars left by previous tests
    document.documentElement.style.cssText = '';
  });

  it('defaults to "dark" when nothing is stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('reads "light" from stored preferences', () => {
    setStoredPrefs('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('reads "dark" from stored preferences', () => {
    setStoredPrefs('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('sets data-theme to "dark" on mount when no preferences stored', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme to "light" on mount when light is stored', () => {
    setStoredPrefs('light');
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates data-theme attribute when theme toggles', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles from dark to light', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });

  it('toggles from light back to dark', () => {
    setStoredPrefs('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
  });

  it('toggles back and forth multiple times', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
  });

  it('persists the new mode to localStorage when toggled', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.mode).toBe('light');
  });

  it('migrates old "theme" localStorage key', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();
  });
});
