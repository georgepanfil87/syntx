import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { I18nService } from '../../../../core/i18n/i18n.service';

import { Button } from '../../../../shared/ui';
import { AiFeaturesService } from '../../../../core/services/ai/ai-features.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog/confirm-dialog.service';
import { ModelsService } from '../../../../core/services/models/models.service';
import { PreferencesService } from '../../../../core/services/preferences/preferences.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import {
  AppearanceSection,
  ChatSection,
  EditorSection,
  LanguageSection,
  ServerSection,
} from '../../components';

@Component({
  selector: 'sx-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppearanceSection, LanguageSection, ChatSection, EditorSection, ServerSection, Button],
  template: `
    <div class="w-full mx-auto p-6 space-y-6 animate-fade-up flex flex-col gap-2">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-primary">
          {{ i18n.t('settings.tagline') }}
        </p>
        <h1 class="text-3xl font-semibold mt-1">
          <span class="gradient-text">{{ i18n.t('settings.heading') }}</span>
        </h1>
        <p class="text-sm text-muted-foreground mt-1 max-w-xl">
          {{ i18n.t('settings.subheading') }}
        </p>
      </header>

      <settings-appearance />
      <settings-language />
      <settings-chat />
      <settings-editor />
      <settings-server />

      <div class="flex justify-end">
        <sx-button variant="ghost" size="sm" (click)="reset()">
          {{ i18n.t('settings.reset') }}
        </sx-button>
      </div>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly prefs = inject(PreferencesService);
  private readonly models = inject(ModelsService);
  private readonly aiFeatures = inject(AiFeaturesService);
  private readonly confirmDlg = inject(ConfirmDialogService);
  private readonly toasts = inject(ToastService);

  ngOnInit(): void {
    this.models.loadOnce();
    this.aiFeatures.loadOnce();
  }

  protected async reset(): Promise<void> {
    const ok = await this.confirmDlg.ask({
      title: this.i18n.t('settings.resetConfirmTitle'),
      body: this.i18n.t('settings.resetConfirmBody'),
      confirmLabel: this.i18n.t('settings.resetConfirm'),
      danger: true,
    });
    if (!ok) return;
    this.prefs.reset();
    this.toasts.success(this.i18n.t('settings.resetToast'));
  }
}
