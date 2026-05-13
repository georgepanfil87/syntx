import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Card } from '../../../../shared/ui';
import { LANGUAGES, Lang } from '../../../../core/i18n/dictionaries';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PreferencesService } from '../../../../core/services/preferences/preferences.service';

@Component({
  selector: 'settings-language',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <sx-card variant="elevated">
      <header slot="header">
        <h2 class="text-sm font-semibold">{{ i18n.t('settings.language') }}</h2>
      </header>

      <div class="grid grid-cols-2 gap-2">
        @for (l of languages; track l.code) {
          <button
            type="button"
            (click)="setLanguage(l.code)"
            [class.border-primary]="prefs.language() === l.code"
            [class.bg-secondary]="prefs.language() === l.code"
            class="rounded-md border border-border px-3 py-2 text-xs hover:border-primary/50 transition text-left"
          >
            <div class="font-medium">{{ l.native }}</div>
            <div class="text-[10px] text-muted-foreground font-mono uppercase">{{ l.code }}</div>
          </button>
        }
      </div>
    </sx-card>
  `,
})
export class LanguageSection {
  protected readonly prefs = inject(PreferencesService);
  protected readonly i18n = inject(I18nService);

  protected readonly languages = LANGUAGES;

  protected setLanguage(lang: Lang): void {
    this.prefs.setLanguage(lang);
  }
}
