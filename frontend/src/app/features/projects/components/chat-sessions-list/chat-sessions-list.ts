import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { ChatSessionRef } from '../../../../core/models/chat.model';
import { Icon } from "../../../../shared/ui";

@Component({
  selector: 'chat-sessions-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (sessions().length === 0) {
      <p class="text-xs text-muted-foreground italic px-2 py-3">
        {{ i18n.t('chat.sessionsEmpty') }}
      </p>
    } @else {
      <ul class="space-y-1">
        @for (s of sessions(); track s.id) {
          <li
            class="rounded-md border transition"
            [class.border-primary]="activeId() === s.id"
            [class.bg-secondary]="activeId() === s.id"
            [class.border-border]="activeId() !== s.id"
          >
            <button
              type="button"
              class="w-full text-left px-2 py-1.5 min-w-0"
              (click)="onSelect(s.id)"
            >
              <p class="text-xs font-medium truncate" [class.text-primary]="activeId() === s.id">
                {{ s.title || i18n.t('chat.untitledSession') }}
              </p>
              <p class="text-[10px] text-muted-foreground mt-0.5">
                {{ relativeTime(s.updated_at) }}
              </p>
            </button>
            <div
              class="flex items-center gap-0.5 px-1 pb-1.5 text-[10px] text-muted-foreground"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-foreground hover:bg-secondary transition disabled:opacity-50"
                (click)="onRename(s, $event)"
                [disabled]="pendingId(s.id)"
                [attr.aria-label]="i18n.t('chat.actionRename')"
              >
                <sx-icon name="pencil" [size]="10" />
                <span>{{ i18n.t('chat.actionRename') }}</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-foreground hover:bg-secondary transition disabled:opacity-50"
                (click)="onExport(s, $event)"
                [disabled]="pendingId(s.id)"
                [attr.aria-label]="i18n.t('chat.actionExport')"
              >
                <sx-icon name="download" [size]="10" />
                <span>{{ i18n.t('chat.actionExport') }}</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                (click)="onDelete(s, $event)"
                [disabled]="pendingId(s.id)"
                [attr.aria-label]="i18n.t('chat.actionDelete')"
              >
                <sx-icon name="trash" [size]="10" />
                <span>{{ i18n.t('chat.actionDelete') }}</span>
              </button>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class ChatSessionsList {
  protected readonly i18n = inject(I18nService);

  readonly sessions = input.required<readonly ChatSessionRef[]>();
  readonly activeId = input<string | null>(null);
  readonly pendingIds = input<readonly string[]>([]);

  readonly select = output<string>();
  readonly rename = output<ChatSessionRef>();
  readonly export = output<ChatSessionRef>();
  readonly delete = output<ChatSessionRef>();

  /** Pre-computed pending lookup; stays cheap because the list is short. */
  protected readonly pendingId = (id: string): boolean =>
    this.pendingIds().includes(id);

  protected onSelect(id: string): void {
    this.select.emit(id);
  }

  protected onRename(s: ChatSessionRef, ev: Event): void {
    ev.stopPropagation();
    this.rename.emit(s);
  }

  protected onExport(s: ChatSessionRef, ev: Event): void {
    ev.stopPropagation();
    this.export.emit(s);
  }

  protected onDelete(s: ChatSessionRef, ev: Event): void {
    ev.stopPropagation();
    this.delete.emit(s);
  }

  protected relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diffMs = Date.now() - then;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return this.i18n.t('chat.timeNow');
    if (min < 60) return this.i18n.t('chat.timeMin', { n: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return this.i18n.t('chat.timeHour', { n: hr });
    const day = Math.floor(hr / 24);
    if (day < 7) return this.i18n.t('chat.timeDay', { n: day });
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(then));
  }

  // Reserved for future fullscreen view
  protected readonly count = computed(() => this.sessions().length);
}
