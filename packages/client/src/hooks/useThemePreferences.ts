import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColorScheme, Mode, ThemePreferences } from '../theme/types';
import { DEFAULT_PREFERENCES } from '../theme/types';
import { getScheme, getSchemesForMode } from '../theme/schemes';
import { applySchemeColors, applySchemeHljs, clearSchemeColors } from '../theme/applyScheme';

const STORAGE_KEY = 'theme-preferences';
const OLD_STORAGE_KEY = 'theme';

function migrateOldTheme(): ThemePreferences | null {
  try {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old === null) return null;
    const mode = JSON.parse(old) as string;
    if (mode !== 'dark' && mode !== 'light') return null;
    localStorage.removeItem(OLD_STORAGE_KEY);
    return { ...DEFAULT_PREFERENCES, mode: mode as Mode };
  } catch {
    return null;
  }
}

export function readStoredPreferences(): ThemePreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ThemePreferences;
  } catch {
    // fall through
  }
  return migrateOldTheme() ?? DEFAULT_PREFERENCES;
}

export function resolveScheme(prefs: ThemePreferences): ColorScheme {
  const id = prefs.mode === 'dark' ? prefs.darkSchemeId : prefs.lightSchemeId;
  const scheme = getScheme(id);
  if (scheme) return scheme;
  const fallback = getSchemesForMode(prefs.mode)[0];
  if (fallback) return fallback;
  return getSchemesForMode('dark')[0] as ColorScheme;
}

function applyTheme(scheme: ColorScheme): void {
  document.documentElement.setAttribute('data-theme', scheme.mode);
  applySchemeColors(scheme);
  applySchemeHljs(scheme);
}

function persistPreferences(prefs: ThemePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore write errors (quota exceeded, private browsing)
  }
}

// Apply theme eagerly on module load to prevent flash of wrong theme.
applyTheme(resolveScheme(readStoredPreferences()));

export interface UseThemePreferencesReturn {
  mode: Mode;
  activeScheme: ColorScheme;
  darkSchemeId: string;
  lightSchemeId: string;
  toggleMode: () => void;
  setDarkScheme: (id: string) => void;
  setLightScheme: (id: string) => void;
  previewScheme: (scheme: ColorScheme) => void;
  clearPreview: () => void;
}

export function useThemePreferences(): UseThemePreferencesReturn {
  const [prefs, setPrefsState] = useState<ThemePreferences>(readStoredPreferences);
  const activeScheme = resolveScheme(prefs);
  const previewRef = useRef<ColorScheme | null>(null);

  const setPrefs = useCallback((next: ThemePreferences) => {
    setPrefsState(next);
    persistPreferences(next);
  }, []);

  // Apply the active scheme whenever preferences change
  useEffect(() => {
    if (!previewRef.current) {
      applyTheme(activeScheme);
    }
  }, [activeScheme]);

  const toggleMode = useCallback(() => {
    setPrefs({ ...prefs, mode: prefs.mode === 'dark' ? 'light' : 'dark' });
    previewRef.current = null;
  }, [prefs, setPrefs]);

  const setDarkScheme = useCallback(
    (id: string) => {
      setPrefs({ ...prefs, darkSchemeId: id });
      previewRef.current = null;
    },
    [prefs, setPrefs],
  );

  const setLightScheme = useCallback(
    (id: string) => {
      setPrefs({ ...prefs, lightSchemeId: id });
      previewRef.current = null;
    },
    [prefs, setPrefs],
  );

  const previewScheme = useCallback((scheme: ColorScheme) => {
    previewRef.current = scheme;
    applyTheme(scheme);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      clearSchemeColors(previewRef.current);
      previewRef.current = null;
      applyTheme(activeScheme);
    }
  }, [activeScheme]);

  return {
    mode: prefs.mode,
    activeScheme,
    darkSchemeId: prefs.darkSchemeId,
    lightSchemeId: prefs.lightSchemeId,
    toggleMode,
    setDarkScheme,
    setLightScheme,
    previewScheme,
    clearPreview,
  };
}
