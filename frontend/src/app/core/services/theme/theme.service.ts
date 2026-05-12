import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  ResolvedThemeMode,
  ThemeFamily,
  monacoThemeFor,
  THEME_FAMILY_CLASS_NAMES,
  THEME_FAMILIES,
  ThemeMode,
} from '../../../themes';
import { PreferencesService } from '../preferences/preferences.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly prefs = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  /** Tracks the OS preference; flips when the user changes their OS theme. */
  private readonly _systemDark = signal<boolean>(this.detectSystemDark());

  /** Resolved mode: `system` collapsed to `dark` or `light`. */
  readonly resolvedMode = computed<ResolvedThemeMode>(() => {
    const mode = this.prefs.themeMode();
    if (mode === 'system') return this._systemDark() ? 'dark' : 'light';
    return mode;
  });

  readonly family = computed<ThemeFamily>(() => this.prefs.themeFamily());

  readonly monacoTheme = computed<'vs-dark' | 'vs'>(() => monacoThemeFor(this.resolvedMode()));

  /** Coarse boolean exposed for consumers that just need to flip a non-themed asset. */
  readonly isDark = computed<boolean>(() => this.resolvedMode() === 'dark');

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (ev: MediaQueryListEvent) => this._systemDark.set(ev.matches);
      try {
        mql.addEventListener('change', handler);
        this.destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
      } catch {
        mql.addListener(handler);
        this.destroyRef.onDestroy(() => mql.removeListener(handler));
      }
    }

    // Apply both classes to <html>. Strips any previously-applied
    // family/mode classes first so swapping doesn't stack them.
    effect(() => {
      const family = this.family();
      const mode = this.resolvedMode();
      if (typeof document === 'undefined') return;

      const root = document.documentElement;
      for (const cls of THEME_FAMILY_CLASS_NAMES) root.classList.remove(cls);
      root.classList.remove('dark', 'light');

      const descriptor = THEME_FAMILIES.find((f) => f.code === family);
      if (descriptor) root.classList.add(descriptor.className);
      root.classList.add(mode);

      root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
    });
  }

  setThemeFamily(family: ThemeFamily): void {
    this.prefs.setThemeFamily(family);
  }

  setThemeMode(mode: ThemeMode): void {
    this.prefs.setThemeMode(mode);
  }

  private detectSystemDark(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
