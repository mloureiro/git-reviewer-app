import { useThemePreferences } from './useThemePreferences';

type Theme = 'dark' | 'light';

/**
 * Backward-compatible wrapper around useThemePreferences.
 * Returns the same { theme, toggleTheme } interface the rest of the app expects.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const { mode, toggleMode } = useThemePreferences();
  return { theme: mode, toggleTheme: toggleMode };
}
