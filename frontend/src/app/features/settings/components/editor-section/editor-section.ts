import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Card, Select, SelectOption } from '../../../../shared/ui';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ModelsService } from '../../../../core/services/models/models.service';
import { PreferencesService } from '../../../../core/services/preferences/preferences.service';
import { formatSize } from '../chat-section/chat-section';
import { isGenerativeModel } from '../../../../core/utils/model-capability';

@Component({
  selector: 'settings-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Select],
  template: `
    <sx-card variant="elevated">
      <header slot="header">
        <h2 class="text-sm font-semibold">{{ i18n.t('settings.editor') }}</h2>
      </header>

      <div class="space-y-3">
        <label class="flex items-center justify-between gap-3">
          <span class="space-y-0.5">
            <span class="text-sm block">{{ i18n.t('settings.inlineCompletions') }}</span>
            <span class="text-[10px] text-muted-foreground block">
              {{ i18n.t('settings.inlineCompletionsHint') }}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            [attr.aria-checked]="prefs.inlineCompletionsEnabled() ? 'true' : 'false'"
            (click)="prefs.setInlineCompletionsEnabled(!prefs.inlineCompletionsEnabled())"
            [class.bg-primary]="prefs.inlineCompletionsEnabled()"
            [class.bg-secondary]="!prefs.inlineCompletionsEnabled()"
            class="relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border transition"
          >
            <span
              class="inline-block h-4 w-4 rounded-full bg-foreground transition-transform"
              [class.translate-x-4]="prefs.inlineCompletionsEnabled()"
              [class.translate-x-0.5]="!prefs.inlineCompletionsEnabled()"
              [style.margin-top.px]="0.5"
            ></span>
          </button>
        </label>

        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">{{
            i18n.t('settings.completionModel')
          }}</span>
          <sx-select
            [options]="modelOptions()"
            [value]="prefs.completionModel()"
            (valueChange)="prefs.setCompletionModel($event)"
            [disabled]="!prefs.inlineCompletionsEnabled()"
            [placeholder]="'qwen2.5-coder:1.5b'"
            [emptyHint]="i18n.t('settings.ollamaOffline')"
          />
        </label>
      </div>
    </sx-card>
  `,
})
export class EditorSection {
  protected readonly prefs = inject(PreferencesService);
  protected readonly models = inject(ModelsService);
  protected readonly i18n = inject(I18nService);

  protected readonly modelOptions = computed<SelectOption[]>(() =>
    (this.models.data()?.items ?? [])
      .filter((m) => isGenerativeModel(m.name))
      .map((m) => ({
        value: m.name,
        label: m.name,
        hint: formatSize(m.size_bytes),
      })),
  );
}
