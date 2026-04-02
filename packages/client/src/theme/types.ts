export type Mode = 'dark' | 'light';

export interface ColorScheme {
  id: string;
  name: string;
  mode: Mode;
  colors: Record<string, string>;
  hljs: HljsColors;
}

export interface HljsColors {
  base: string;
  baseBg: string;
  keyword: string;
  title: string;
  attr: string;
  string: string;
  builtIn: string;
  comment: string;
  tag: string;
  subst: string;
  section: string;
  sectionFontWeight: string;
  bullet: string;
  emphasis: string;
  emphasisFontStyle: string;
  strong: string;
  strongFontWeight: string;
  addition: string;
  additionBg: string;
  deletion: string;
  deletionBg: string;
}

export interface ThemePreferences {
  mode: Mode;
  darkSchemeId: string;
  lightSchemeId: string;
}

export const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  darkSchemeId: 'github-dark',
  lightSchemeId: 'github-light',
};
