import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Card, Select, SelectOption } from "../../../../shared/ui";
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ModelsService } from '../../../../core/services/models/models.service';
import { PreferencesService } from '../../../../core/services/preferences/preferences.service';

@Component({
  selector: 'settings-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Select],
  template: `
    <sx-card variant="elevated">
      <header slot="header"><h2 class="text-sm font-semibold">{{ i18n.t('settings.chat') }}</h2></header>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">{{ i18n.t('settings.chatModel') }}</span>
        <sx-select
          [options]="modelOptions()"
          [value]="prefs.chatModel()"
          (valueChange)="prefs.setChatModel($event)"
          [placeholder]="'qwen2.5-coder:1.5b'"
          [emptyHint]="i18n.t('settings.ollamaOffline')"
        />
      </label>
    </sx-card>
  `,
})
export class ChatSection{
  protected readonly prefs = inject(PreferencesService);
  protected readonly models = inject(ModelsService);
  protected readonly i18n = inject(I18nService);

  protected readonly modelOptions = computed<SelectOption[]>(() =>
    (this.models.data()?.items ?? []).map((m) => ({
      value: m.name,
      label: m.name,
      hint: formatSize(m.size_bytes),
    })),
  );
}


export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  // One decimal for values < 10 in their unit (e.g. 1.5 GB); none for
  // larger values where the extra digit doesn't add information.
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
