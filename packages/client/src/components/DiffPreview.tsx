import type { ColorScheme } from '../theme/types';

interface DiffPreviewProps {
  scheme: ColorScheme;
}

/**
 * A small static diff preview that renders a few sample lines using the
 * scheme's colors directly via inline styles. Used in the settings page
 * to give a feel for how each color scheme looks on actual code.
 */
export function DiffPreview({ scheme }: DiffPreviewProps) {
  const c = scheme.colors;
  const h = scheme.hljs;

  const bgPrimary = c['color-bg-primary'];
  const borderColor = c['color-border-subtle'];
  const textMuted = c['color-text-muted'];
  const textPrimary = c['color-text-primary'];
  const insBg = c['color-diff-ins-bg'];
  const insPrefix = c['color-diff-ins-prefix'];
  const delBg = c['color-diff-del-bg'];
  const delPrefix = c['color-diff-del-prefix'];
  const infoBg = c['color-info-bg'];

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.6875rem',
    lineHeight: '1.45',
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    background: bgPrimary,
    borderRadius: '6px',
    overflow: 'hidden',
    tableLayout: 'fixed',
  };

  const lineNumStyle: React.CSSProperties = {
    width: '28px',
    minWidth: '28px',
    padding: '0 4px',
    textAlign: 'right',
    color: textMuted,
    background: bgPrimary,
    borderRight: `1px solid ${borderColor}`,
    userSelect: 'none',
    verticalAlign: 'top',
  };

  const codeStyle: React.CSSProperties = {
    padding: '0 8px',
    whiteSpace: 'pre',
    color: textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div
      className="diff-preview"
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      <table style={tableStyle}>
        <tbody>
          {/* Hunk header */}
          <tr>
            <td style={{ ...lineNumStyle, background: infoBg }} />
            <td
              style={{
                ...codeStyle,
                background: infoBg,
                color: textMuted,
                fontStyle: 'italic',
              }}
            >
              @@ -1,4 +1,4 @@
            </td>
          </tr>
          {/* Context line */}
          <tr>
            <td style={lineNumStyle}>1</td>
            <td style={codeStyle}>
              <span style={{ color: h.keyword }}>import</span>
              <span> {'{ '}</span>
              <span style={{ color: h.attr }}>useState</span>
              <span>{' }'} </span>
              <span style={{ color: h.keyword }}>from</span>
              <span> </span>
              <span style={{ color: h.string }}>&apos;react&apos;</span>
              <span>;</span>
            </td>
          </tr>
          {/* Deletion */}
          <tr style={{ background: delBg }}>
            <td style={{ ...lineNumStyle, background: delBg }}>2</td>
            <td style={{ ...codeStyle, background: delBg }}>
              <span style={{ color: delPrefix, marginRight: '4px' }}>-</span>
              <span style={{ color: h.keyword }}>const</span>
              <span> theme = </span>
              <span style={{ color: h.string }}>&apos;dark&apos;</span>
              <span>;</span>
            </td>
          </tr>
          {/* Insertion */}
          <tr style={{ background: insBg }}>
            <td style={{ ...lineNumStyle, background: insBg }}>2</td>
            <td style={{ ...codeStyle, background: insBg }}>
              <span style={{ color: insPrefix, marginRight: '4px' }}>+</span>
              <span style={{ color: h.keyword }}>const</span>
              <span> theme = </span>
              <span style={{ color: h.title }}>getTheme</span>
              <span>(</span>
              <span style={{ color: h.string }}>&apos;user&apos;</span>
              <span>);</span>
            </td>
          </tr>
          {/* Context line */}
          <tr>
            <td style={lineNumStyle}>3</td>
            <td style={codeStyle}>
              <span style={{ color: h.keyword }}>const</span>
              <span> [</span>
              <span style={{ color: h.attr }}>count</span>
              <span>, </span>
              <span style={{ color: h.attr }}>setCount</span>
              <span>] = </span>
              <span style={{ color: h.title }}>useState</span>
              <span>(</span>
              <span style={{ color: h.attr }}>0</span>
              <span>);</span>
            </td>
          </tr>
          {/* Context line */}
          <tr>
            <td style={lineNumStyle}>4</td>
            <td style={codeStyle}>
              <span style={{ color: h.comment }}>{'// render'}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
