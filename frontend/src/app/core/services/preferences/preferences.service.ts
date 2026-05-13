import { Injectable, effect, signal } from '@angular/core';
import { ThemeFamily, ThemeMode } from '../../../themes';
import { Lang } from '../../i18n/dictionaries';

export type ThemePreference =
  | 'system'
  | 'midnight'
  | 'daylight'
  | 'forest'
  | 'sunset'
  | 'dark'
  | 'light';

export interface PersistedPreferences {
  version: number;
  themeFamily: ThemeFamily;
  themeMode: ThemeMode;
  language: Lang;
  chatModel: string;
  completionModel: string;
  inlineCompletionsEnabled: boolean;
  treePaneWidth: number;
  chatPaneWidth: number;
  sidebarWidth: number;
}

export const TREE_PANE_MIN = 180;
export const TREE_PANE_MAX = 520;
export const CHAT_PANE_MIN = 400;
export const CHAT_PANE_MAX = 640;
export const SIDEBAR_MIN = 64;
export const SIDEBAR_MAX = 200;

export const SIDEBAR_COMPACT_THRESHOLD = 120;

const STORAGE_KEY = 'syntx.preferences.v1';
const STORAGE_VERSION = 2;

const FACTORY_DEFAULTS: PersistedPreferences = {
  version: STORAGE_VERSION,
  themeFamily: 'midnight',
  themeMode: 'system',
  language: 'en',
  chatModel: 'qwen2.5-coder:1.5b',
  completionModel: 'qwen2.5-coder:1.5b',
  inlineCompletionsEnabled: false,
  treePaneWidth: 240,
  chatPaneWidth: 360,
  sidebarWidth: 200,
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly _themeFamily = signal<ThemeFamily>(FACTORY_DEFAULTS.themeFamily);
  private readonly _themeMode = signal<ThemeMode>(FACTORY_DEFAULTS.themeMode);
  private readonly _language = signal<Lang>(FACTORY_DEFAULTS.language);
  private readonly _chatModel = signal<string>(FACTORY_DEFAULTS.chatModel);
  private readonly _completionModel = signal<string>(FACTORY_DEFAULTS.completionModel);
  private readonly _inlineCompletionsEnabled = signal<boolean>(
    FACTORY_DEFAULTS.inlineCompletionsEnabled,
  );
  private readonly _treePaneWidth = signal<number>(FACTORY_DEFAULTS.treePaneWidth);
  private readonly _chatPaneWidth = signal<number>(FACTORY_DEFAULTS.chatPaneWidth);
  private readonly _sidebarWidth = signal<number>(FACTORY_DEFAULTS.sidebarWidth);

  readonly themeFamily = this._themeFamily.asReadonly();
  readonly themeMode = this._themeMode.asReadonly();
  readonly language = this._language.asReadonly();
  readonly chatModel = this._chatModel.asReadonly();
  readonly completionModel = this._completionModel.asReadonly();
  readonly inlineCompletionsEnabled = this._inlineCompletionsEnabled.asReadonly();
  readonly treePaneWidth = this._treePaneWidth.asReadonly();
  readonly chatPaneWidth = this._chatPaneWidth.asReadonly();
  readonly sidebarWidth = this._sidebarWidth.asReadonly();

  constructor() {
    this.load();

    effect(() => {
      this.write({
        version: STORAGE_VERSION,
        themeFamily: this._themeFamily(),
        themeMode: this._themeMode(),
        language: this._language(),
        chatModel: this._chatModel(),
        completionModel: this._completionModel(),
        inlineCompletionsEnabled: this._inlineCompletionsEnabled(),
        treePaneWidth: this._treePaneWidth(),
        chatPaneWidth: this._chatPaneWidth(),
        sidebarWidth: this._sidebarWidth(),
      });
    });
  }

  setThemeFamily(family: ThemeFamily): void {
    this._themeFamily.set(family);
  }

  setThemeMode(mode: ThemeMode): void {
    this._themeMode.set(mode);
  }

  setLanguage(lang: Lang): void {
    this._language.set(lang);
  }

  setChatModel(name: string): void {
    this._chatModel.set(name || FACTORY_DEFAULTS.chatModel);
  }

  setCompletionModel(name: string): void {
    this._completionModel.set(name || FACTORY_DEFAULTS.completionModel);
  }

  setInlineCompletionsEnabled(enabled: boolean): void {
    this._inlineCompletionsEnabled.set(enabled);
  }

  setTreePaneWidth(px: number): void {
    this._treePaneWidth.set(clamp(px, TREE_PANE_MIN, TREE_PANE_MAX));
  }

  setChatPaneWidth(px: number): void {
    this._chatPaneWidth.set(clamp(px, CHAT_PANE_MIN, CHAT_PANE_MAX));
  }

  setSidebarWidth(px: number): void {
    this._sidebarWidth.set(clamp(px, SIDEBAR_MIN, SIDEBAR_MAX));
  }
  reset(): void {
    this._themeFamily.set(FACTORY_DEFAULTS.themeFamily);
    this._themeMode.set(FACTORY_DEFAULTS.themeMode);
    this._language.set(FACTORY_DEFAULTS.language);
    this._chatModel.set(FACTORY_DEFAULTS.chatModel);
    this._completionModel.set(FACTORY_DEFAULTS.completionModel);
    this._inlineCompletionsEnabled.set(FACTORY_DEFAULTS.inlineCompletionsEnabled);
    this._treePaneWidth.set(FACTORY_DEFAULTS.treePaneWidth);
    this._chatPaneWidth.set(FACTORY_DEFAULTS.chatPaneWidth);
    this._sidebarWidth.set(FACTORY_DEFAULTS.sidebarWidth);
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        PersistedPreferences & { theme?: ThemePreference }
      > | null;
      if (!parsed) return;

      if (parsed.version === 1 && typeof parsed.theme === 'string') {
        const migrated = migrateLegacyTheme(parsed.theme as ThemePreference);
        this._themeFamily.set(migrated.family);
        this._themeMode.set(migrated.mode);
      } else if (parsed.version !== STORAGE_VERSION) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      } else {
        if (isThemeFamily(parsed.themeFamily)) this._themeFamily.set(parsed.themeFamily);
        if (isThemeMode(parsed.themeMode)) this._themeMode.set(parsed.themeMode);
      }

      if (parsed.language === 'en' || parsed.language === 'ro') {
        this._language.set(parsed.language);
      }
      if (typeof parsed.chatModel === 'string' && parsed.chatModel.length > 0) {
        this._chatModel.set(parsed.chatModel);
      }
      if (typeof parsed.completionModel === 'string' && parsed.completionModel.length > 0) {
        this._completionModel.set(parsed.completionModel);
      }
      if (typeof parsed.inlineCompletionsEnabled === 'boolean') {
        this._inlineCompletionsEnabled.set(parsed.inlineCompletionsEnabled);
      }
      if (typeof parsed.treePaneWidth === 'number' && Number.isFinite(parsed.treePaneWidth)) {
        this._treePaneWidth.set(clamp(parsed.treePaneWidth, TREE_PANE_MIN, TREE_PANE_MAX));
      }
      if (typeof parsed.chatPaneWidth === 'number' && Number.isFinite(parsed.chatPaneWidth)) {
        this._chatPaneWidth.set(clamp(parsed.chatPaneWidth, CHAT_PANE_MIN, CHAT_PANE_MAX));
      }
      if (typeof parsed.sidebarWidth === 'number' && Number.isFinite(parsed.sidebarWidth)) {
        this._sidebarWidth.set(clamp(parsed.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX));
      }
    } catch {}
  }

  private write(snapshot: PersistedPreferences): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
  }
}

function isThemeFamily(value: unknown): value is ThemeFamily {
  return value === 'midnight' || value === 'forest' || value === 'sunset';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'dark' || value === 'light';
}

function migrateLegacyTheme(value: ThemePreference): { family: ThemeFamily; mode: ThemeMode } {
  switch (value) {
    case 'forest':
      return { family: 'forest', mode: 'dark' };
    case 'sunset':
      return { family: 'sunset', mode: 'dark' };
    case 'daylight':
    case 'light':
      return { family: 'midnight', mode: 'light' };
    case 'midnight':
    case 'dark':
      return { family: 'midnight', mode: 'dark' };
    case 'system':
    default:
      return { family: 'midnight', mode: 'system' };
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
