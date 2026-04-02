import { useThemePreferences } from '../hooks/useThemePreferences';
import { getSchemesForMode } from '../theme/schemes';
import { SchemeCard } from '../components/SchemeCard';

export function SettingsPage() {
  const {
    mode,
    darkSchemeId,
    lightSchemeId,
    toggleMode,
    setDarkScheme,
    setLightScheme,
    previewScheme,
    clearPreview,
  } = useThemePreferences();

  const darkSchemes = getSchemesForMode('dark');
  const lightSchemes = getSchemesForMode('light');

  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">Settings</h1>
      </div>

      <section className="settings__section">
        <h2 className="settings__section-title">Appearance</h2>
        <div className="settings__mode-toggle">
          <span className="settings__mode-label">Mode</span>
          <div className="settings__mode-buttons">
            <button
              className={`settings__mode-btn${mode === 'dark' ? ' settings__mode-btn--active' : ''}`}
              onClick={mode === 'light' ? toggleMode : undefined}
            >
              Dark
            </button>
            <button
              className={`settings__mode-btn${mode === 'light' ? ' settings__mode-btn--active' : ''}`}
              onClick={mode === 'dark' ? toggleMode : undefined}
            >
              Light
            </button>
          </div>
        </div>
      </section>

      <div className="settings__schemes">
        <section className="settings__scheme-group">
          <h3 className="settings__scheme-group-title">Dark Mode Scheme</h3>
          <div className="settings__scheme-grid">
            {darkSchemes.map((scheme) => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                selected={scheme.id === darkSchemeId}
                onSelect={() => setDarkScheme(scheme.id)}
                onPreview={() => previewScheme(scheme)}
                onClearPreview={clearPreview}
              />
            ))}
          </div>
        </section>

        <section className="settings__scheme-group">
          <h3 className="settings__scheme-group-title">Light Mode Scheme</h3>
          <div className="settings__scheme-grid">
            {lightSchemes.map((scheme) => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                selected={scheme.id === lightSchemeId}
                onSelect={() => setLightScheme(scheme.id)}
                onPreview={() => previewScheme(scheme)}
                onClearPreview={clearPreview}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
