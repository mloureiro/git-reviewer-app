import type { ColorScheme } from '../theme/types';

const SWATCH_KEYS = [
  'color-bg-primary',
  'color-accent',
  'color-success',
  'color-danger',
  'color-diff-ins-prefix',
  'color-diff-del-prefix',
] as const;

interface SchemeCardProps {
  scheme: ColorScheme;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onClearPreview: () => void;
}

export function SchemeCard({
  scheme,
  selected,
  onSelect,
  onPreview,
  onClearPreview,
}: SchemeCardProps) {
  return (
    <button
      className={`scheme-card${selected ? ' scheme-card--selected' : ''}`}
      onClick={onSelect}
      onMouseEnter={onPreview}
      onMouseLeave={onClearPreview}
      aria-pressed={selected}
      title={scheme.name}
    >
      <div className="scheme-card__swatches">
        {SWATCH_KEYS.map((key) => (
          <span
            key={key}
            className="scheme-card__swatch"
            style={{ backgroundColor: scheme.colors[key] }}
          />
        ))}
      </div>
      <span className="scheme-card__name">{scheme.name}</span>
      {selected && (
        <span className="scheme-card__check" aria-label="Selected">
          &#10003;
        </span>
      )}
    </button>
  );
}
