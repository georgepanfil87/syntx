
export type ThemeFamily = 'midnight' | 'forest' | 'sunset';
export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedThemeMode = 'dark' | 'light';

export interface ThemeFamilyDescriptor {
  readonly code: ThemeFamily;
  readonly i18nKey: string;
  readonly i18nHintKey: string;
  readonly className: string;
}

export const THEME_FAMILIES: readonly ThemeFamilyDescriptor[] = [
  { code: 'midnight', i18nKey: 'settings.themeMidnight', i18nHintKey: 'settings.themeMidnightHint', className: 'theme-midnight' },
  { code: 'forest',   i18nKey: 'settings.themeForest',   i18nHintKey: 'settings.themeForestHint',   className: 'theme-forest' },
  { code: 'sunset',   i18nKey: 'settings.themeSunset',   i18nHintKey: 'settings.themeSunsetHint',   className: 'theme-sunset' },
];

export interface ThemeModeDescriptor {
  readonly code: ThemeMode;
  readonly i18nKey: string;
  readonly i18nHintKey: string;
}

export const THEME_MODES: readonly ThemeModeDescriptor[] = [
  { code: 'system', i18nKey: 'settings.themeSystem', i18nHintKey: 'settings.themeSystemHint' },
  { code: 'dark',   i18nKey: 'settings.modeDark',    i18nHintKey: 'settings.modeDarkHint' },
  { code: 'light',  i18nKey: 'settings.modeLight',   i18nHintKey: 'settings.modeLightHint' },
];

export const THEME_FAMILY_CLASS_NAMES: readonly string[] =
  THEME_FAMILIES.map((f) => f.className);


export function monacoThemeFor(mode: ResolvedThemeMode): 'vs-dark' | 'vs' {
  return mode === 'light' ? 'vs' : 'vs-dark';
}
