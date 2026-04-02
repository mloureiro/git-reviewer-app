import type { ColorScheme, HljsColors } from './types';

const HLJS_STYLE_ID = 'hljs-scheme';

/**
 * Applies a color scheme's CSS custom properties to <html> element.
 * Inline styles override the fallback [data-theme] blocks in styles.css.
 */
export function applySchemeColors(scheme: ColorScheme): void {
  const style = document.documentElement.style;
  for (const [prop, value] of Object.entries(scheme.colors)) {
    style.setProperty(`--${prop}`, value);
  }
}

/**
 * Removes all inline CSS custom properties set by applySchemeColors,
 * reverting to the fallback [data-theme] blocks in styles.css.
 */
export function clearSchemeColors(scheme: ColorScheme): void {
  const style = document.documentElement.style;
  for (const prop of Object.keys(scheme.colors)) {
    style.removeProperty(`--${prop}`);
  }
}

/**
 * Generates and injects a <style> block for highlight.js theme colors
 * scoped under the current data-theme attribute.
 */
export function applySchemeHljs(scheme: ColorScheme): void {
  let styleEl = document.getElementById(HLJS_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = HLJS_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = generateHljsCss(scheme.mode, scheme.hljs);
}

function generateHljsCss(mode: string, hljs: HljsColors): string {
  const scope = `[data-theme='${mode}']`;
  return `
${scope} .hljs { color: ${hljs.base}; background: ${hljs.baseBg}; }
${scope} .hljs-doctag,
${scope} .hljs-keyword,
${scope} .hljs-meta .hljs-keyword,
${scope} .hljs-template-tag,
${scope} .hljs-template-variable,
${scope} .hljs-type,
${scope} .hljs-variable.language_ { color: ${hljs.keyword}; }
${scope} .hljs-title,
${scope} .hljs-title.class_,
${scope} .hljs-title.class_.inherited__,
${scope} .hljs-title.function_ { color: ${hljs.title}; }
${scope} .hljs-attr,
${scope} .hljs-attribute,
${scope} .hljs-literal,
${scope} .hljs-meta,
${scope} .hljs-number,
${scope} .hljs-operator,
${scope} .hljs-variable,
${scope} .hljs-selector-attr,
${scope} .hljs-selector-class,
${scope} .hljs-selector-id { color: ${hljs.attr}; }
${scope} .hljs-regexp,
${scope} .hljs-string,
${scope} .hljs-meta .hljs-string { color: ${hljs.string}; }
${scope} .hljs-built_in,
${scope} .hljs-symbol { color: ${hljs.builtIn}; }
${scope} .hljs-comment,
${scope} .hljs-code,
${scope} .hljs-formula { color: ${hljs.comment}; }
${scope} .hljs-name,
${scope} .hljs-quote,
${scope} .hljs-selector-tag,
${scope} .hljs-selector-pseudo { color: ${hljs.tag}; }
${scope} .hljs-subst { color: ${hljs.subst}; }
${scope} .hljs-section { color: ${hljs.section}; font-weight: ${hljs.sectionFontWeight}; }
${scope} .hljs-bullet { color: ${hljs.bullet}; }
${scope} .hljs-emphasis { color: ${hljs.emphasis}; font-style: ${hljs.emphasisFontStyle}; }
${scope} .hljs-strong { color: ${hljs.strong}; font-weight: ${hljs.strongFontWeight}; }
${scope} .hljs-addition { color: ${hljs.addition}; background-color: ${hljs.additionBg}; }
${scope} .hljs-deletion { color: ${hljs.deletion}; background-color: ${hljs.deletionBg}; }
`.trim();
}
