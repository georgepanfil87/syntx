import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { ChatSessionRef } from '../../../../core/models/chat.model';
import { ChatActions, selectChatError, selectIsSessionPending } from '../../../../core/state/chat';
import { Modal, InputComponent, Button } from '../../../../shared/ui';

/** Backend `CHAT_SESSION_TITLE_MAX_LENGTH` (kept in sync manually). */
const TITLE_MAX = 200;

@Component({
  selector: 'chat-session-rename-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, InputComponent, Button],
  template: `
    <sx-modal
      [open]="open()"
      [title]="i18n.t('chat.sessionRenameTitle')"
      size="sm"
      (close)="cancel()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">
        <sx-input
          formControlName="title"
          [label]="i18n.t('chat.sessionRenameLabel')"
          [placeholder]="i18n.t('chat.sessionRenameLabel')"
          autocomplete="off"
          [error]="titleError()"
        />

        @if (storeError()) {
          <p class="text-xs text-destructive" role="alert">{{ storeError() }}</p>
        }
      </form>

      <div slot="footer">
        <sx-button variant="ghost" (click)="cancel()">{{ i18n.t('common.cancel') }}</sx-button>
        <sx-button type="submit" (click)="submit()" [loading]="pending()">
          {{ i18n.t('chat.sessionRenameSubmit') }}
        </sx-button>
      </div>
    </sx-modal>
  `,
})
export class ChatSessionRenameModal {
  readonly open = input<boolean>(false);
  readonly session = input<ChatSessionRef | null>(null);
  readonly close = output<void>();

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly storeError = this.store.selectSignal(selectChatError);

  protected readonly pending = computed(() => {
    const id = this.session()?.id;
    if (!id) return false;
    return this.store.selectSignal(selectIsSessionPending(id))();
  });

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(TITLE_MAX)]],
  });

  constructor() {
    effect(() => {
      const session = this.session();
      if (this.open() && session) {
        untracked(() => this.form.reset({ title: session.title }));
      }
    });
  }

  protected titleError(): string {
    const c = this.form.controls.title;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Title is required.';
    if (c.errors['maxlength']) return `Title must be ${TITLE_MAX} characters or fewer.`;
    return '';
  }

  protected submit(): void {
    const session = this.session();
    if (!session || this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    const { title } = this.form.getRawValue();
    const trimmed = title.trim();
    if (trimmed === session.title) {
      this.cancel();
      return;
    }
    this.store.dispatch(ChatActions.renameSession({ id: session.id, title: trimmed }));
  }

  protected cancel(): void {
    this.close.emit();
  }
}
