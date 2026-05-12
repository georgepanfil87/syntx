import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AiFeaturesService } from '../../../../core/services/ai/ai-features.service';
import { ModelsService } from '../../../../core/services/models/models.service';
import { Card, Badge } from '../../../../shared/ui';

@Component({
  selector: 'settings-server',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Badge],
  template: `
    <sx-card variant="elevated">
      <header slot="header">
        <h2 class="text-sm font-semibold">{{ i18n.t('settings.server') }}</h2>
      </header>

      <dl class="space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">{{ i18n.t('settings.ollamaDefault') }}</dt>
          <dd class="font-mono text-xs">{{ models.data()?.default_model || '—' }}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">{{ i18n.t('settings.installedModels') }}</dt>
          <dd class="font-mono text-xs">{{ models.data()?.items?.length ?? '—' }}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-muted-foreground">{{ i18n.t('settings.webSearch') }}</dt>
          <dd>
            @if (aiFeatures.data(); as f) {
              @if (f.web_search_enabled) {
                <sx-badge variant="success">{{ i18n.t('settings.enabled') }}</sx-badge>
              } @else {
                <sx-badge variant="outline">{{ i18n.t('settings.disabled') }}</sx-badge>
              }
            } @else {
              <span class="text-muted-foreground text-xs">—</span>
            }
          </dd>
        </div>
      </dl>

      @if (models.error()) {
        <p class="text-xs text-amber-300 mt-3">{{ models.error() }}</p>
      }
    </sx-card>
  `,
})
export class ServerSection {
  protected readonly models = inject(ModelsService);
  protected readonly aiFeatures = inject(AiFeaturesService);
  protected readonly i18n = inject(I18nService);
}
