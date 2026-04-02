import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemePreferences } from './useThemePreferences';
import type { ThemePreferences } from '../theme/types';

const STORAGE_KEY = 'theme-preferences';

function setStoredPrefs(prefs: ThemePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function getStoredPrefs(): ThemePreferences {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
}

describe('useThemePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  it('defaults to dark mode with github schemes', () => {
    const { result } = renderHook(() => useThemePreferences());
    expect(result.current.mode).toBe('dark');
    expect(result.current.darkSchemeId).toBe('github-dark');
    expect(result.current.lightSchemeId).toBe('github-light');
  });

  it('resolves the correct active scheme for default dark mode', () => {
    const { result } = renderHook(() => useThemePreferences());
    expect(result.current.activeScheme.id).toBe('github-dark');
    expect(result.current.activeScheme.mode).toBe('dark');
  });

  // ---------------------------------------------------------------------------
  // Reading from localStorage
  // ---------------------------------------------------------------------------

  it('reads stored preferences', () => {
    setStoredPrefs({ mode: 'light', darkSchemeId: 'dracula', lightSchemeId: 'solarized-light' });
    const { result } = renderHook(() => useThemePreferences());
    expect(result.current.mode).toBe('light');
    expect(result.current.darkSchemeId).toBe('dracula');
    expect(result.current.lightSchemeId).toBe('solarized-light');
    expect(result.current.activeScheme.id).toBe('solarized-light');
  });

  // ---------------------------------------------------------------------------
  // Migration from old "theme" key
  // ---------------------------------------------------------------------------

  it('migrates old "theme" localStorage key to new format', () => {
    localStorage.setItem('theme', JSON.stringify('light'));
    const { result } = renderHook(() => useThemePreferences());

    expect(result.current.mode).toBe('light');
    expect(result.current.darkSchemeId).toBe('github-dark');
    expect(result.current.lightSchemeId).toBe('github-light');
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('ignores invalid old "theme" value and uses defaults', () => {
    localStorage.setItem('theme', JSON.stringify('blue'));
    const { result } = renderHook(() => useThemePreferences());
    expect(result.current.mode).toBe('dark');
  });

  // ---------------------------------------------------------------------------
  // toggleMode
  // ---------------------------------------------------------------------------

  it('toggles mode from dark to light', () => {
    const { result } = renderHook(() => useThemePreferences());
    expect(result.current.mode).toBe('dark');

    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('light');
    expect(result.current.activeScheme.id).toBe('github-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles mode from light to dark', () => {
    setStoredPrefs({ mode: 'light', darkSchemeId: 'github-dark', lightSchemeId: 'github-light' });
    const { result } = renderHook(() => useThemePreferences());

    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('dark');
    expect(result.current.activeScheme.id).toBe('github-dark');
  });

  // ---------------------------------------------------------------------------
  // setDarkScheme / setLightScheme
  // ---------------------------------------------------------------------------

  it('changes dark scheme and persists', () => {
    const { result } = renderHook(() => useThemePreferences());

    act(() => result.current.setDarkScheme('dracula'));
    expect(result.current.darkSchemeId).toBe('dracula');
    expect(result.current.activeScheme.id).toBe('dracula');
    expect(getStoredPrefs().darkSchemeId).toBe('dracula');
  });

  it('changes light scheme and persists', () => {
    setStoredPrefs({ mode: 'light', darkSchemeId: 'github-dark', lightSchemeId: 'github-light' });
    const { result } = renderHook(() => useThemePreferences());

    act(() => result.current.setLightScheme('solarized-light'));
    expect(result.current.lightSchemeId).toBe('solarized-light');
    expect(result.current.activeScheme.id).toBe('solarized-light');
    expect(getStoredPrefs().lightSchemeId).toBe('solarized-light');
  });

  // ---------------------------------------------------------------------------
  // data-theme attribute
  // ---------------------------------------------------------------------------

  it('sets data-theme attribute to match the mode', () => {
    renderHook(() => useThemePreferences());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applies CSS custom properties from the active scheme', () => {
    renderHook(() => useThemePreferences());
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-bg-primary')).toBe('#0d1117');
    expect(style.getPropertyValue('--color-accent')).toBe('#58a6ff');
  });

  // ---------------------------------------------------------------------------
  // Fallback for unknown scheme ID
  // ---------------------------------------------------------------------------

  it('falls back to first scheme for mode if stored ID is invalid', () => {
    setStoredPrefs({ mode: 'dark', darkSchemeId: 'nonexistent', lightSchemeId: 'github-light' });
    const { result } = renderHook(() => useThemePreferences());
    // Should fall back to first dark scheme (github-dark)
    expect(result.current.activeScheme.id).toBe('github-dark');
  });
});
