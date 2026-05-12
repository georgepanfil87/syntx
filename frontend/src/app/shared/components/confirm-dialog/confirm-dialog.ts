import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Button, Modal } from '../../ui';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Modal],
  template: `
    <sx-modal [open]="isOpen()" [title]="state()?.title || ''" size="sm" (close)="cancel()">
      @if (state()?.body; as body) {
        <p class="text-sm text-muted-foreground">{{ body }}</p>
      }

      <div slot="footer">
        <sx-button variant="ghost" (click)="cancel()">
          {{ cancelLabel() }}
        </sx-button>
        <sx-button [variant]="state()?.danger ? 'destructive' : 'primary'" (click)="accept()">
          {{ confirmLabel() }}
        </sx-button>
      </div>
    </sx-modal>
  `,
})
export class ConfirmDialog {
  protected readonly dialog = inject(ConfirmDialogService);
  protected readonly i18n = inject(I18nService);
  protected readonly state = this.dialog.state;
  protected readonly isOpen = computed(() => this.dialog.state() !== null);

  protected readonly confirmLabel = computed(
    () => this.dialog.state()?.confirmLabel ?? this.i18n.t('confirm.defaultConfirm'),
  );
  protected readonly cancelLabel = computed(
    () => this.dialog.state()?.cancelLabel ?? this.i18n.t('confirm.defaultCancel'),
  );

  protected accept(): void {
    this.dialog.accept();
  }

  protected cancel(): void {
    this.dialog.cancel();
  }
}
