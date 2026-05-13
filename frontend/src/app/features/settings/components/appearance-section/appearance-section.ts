import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Card } from '../../../../shared/ui';
import { PreferencesService } from '../../../../core/services/preferences/preferences.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { THEME_FAMILIES, THEME_MODES, ThemeFamily, ThemeMode } from '../../../../themes';

@Component({
  selector: 'settings-appearance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <sx-card variant="elevated">
      <header slot="header" class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">{{ i18n.t('settings.appearance') }}</h2>
        <span class="text-[10px] text-muted-foreground">
          {{
            i18n.t('settings.renderingAs', {
              theme: themeSvc.family() + ' · ' + themeSvc.resolvedMode(),
            })
          }}
        </span>
      </header>

      <div class="space-y-4">
        <div class="space-y-2">
          <span class="text-xs text-muted-foreground">{{ i18n.t('settings.themeFamily') }}</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            @for (fam of families; track fam.code) {
              <button
                type="button"
                (click)="setFamily(fam.code)"
                [class.border-primary]="prefs.themeFamily() === fam.code"
                [class.bg-secondary]="prefs.themeFamily() === fam.code"
                class="rounded-md border border-border px-3 py-2 text-xs hover:border-primary/50 transition text-left"
              >
                <div class="font-medium">{{ i18n.t(fam.i18nKey) }}</div>
                <div class="text-[10px] text-muted-foreground">{{ i18n.t(fam.i18nHintKey) }}</div>
              </button>
            }
          </div>
        </div>

        <div class="space-y-2">
          <span class="text-xs text-muted-foreground">{{ i18n.t('settings.themeMode') }}</span>
          <div class="grid grid-cols-3 gap-2">
            @for (m of modes; track m.code) {
              <button
                type="button"
                (click)="setMode(m.code)"
                [class.border-primary]="prefs.themeMode() === m.code"
                [class.bg-secondary]="prefs.themeMode() === m.code"
                class="rounded-md border border-border px-3 py-2 text-xs hover:border-primary/50 transition text-left"
              >
                <div class="font-medium">{{ i18n.t(m.i18nKey) }}</div>
                <div class="text-[10px] text-muted-foreground">{{ i18n.t(m.i18nHintKey) }}</div>
              </button>
            }
          </div>
        </div>
      </div>
    </sx-card>
  `,
})
export class AppearanceSection {
  protected readonly prefs = inject(PreferencesService);
  protected readonly themeSvc = inject(ThemeService);
  protected readonly i18n = inject(I18nService);

  protected readonly families = THEME_FAMILIES;
  protected readonly modes = THEME_MODES;

  protected setFamily(family: ThemeFamily): void {
    this.prefs.setThemeFamily(family);
  }

  protected setMode(mode: ThemeMode): void {
    this.prefs.setThemeMode(mode);
  }
}
