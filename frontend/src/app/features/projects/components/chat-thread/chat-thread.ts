import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { UiChatMessage } from '../../../../core/state/chat';
import { Icon } from "../../../../shared/ui";
import { ApplyCodeBlockEvent, MessageContent } from "../message-content/message-content";

@Component({
  selector: 'chat-thread',
  imports: [Icon, MessageContent],
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.css',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThread implements AfterViewChecked {
  protected readonly i18n = inject(I18nService);

  readonly messages = input.required<readonly UiChatMessage[]>();
  readonly loading = input<boolean>(false);
  /** Forwarded to `<app-message-content>` for the apply-to-current fallback. */
  readonly openFilePath = input<string | null>(null);
  readonly applyCodeBlock = output<ApplyCodeBlockEvent>();

  @ViewChild('scroller') private scrollerRef?: ElementRef<HTMLElement>;

  /** True when the user is within ~80px of the bottom — sticky scroll on. */
  private stickToBottom = true;

  private readonly openDrawers = signal<ReadonlySet<string>>(new Set());

  protected readonly count = computed(() => this.messages().length);

  constructor() {
    let lastUserCount = 0;
    effect(() => {
      const userMsgs = this.messages().filter((m) => m.role === 'user').length;
      if (userMsgs > lastUserCount) {
        untracked(() => {
          this.stickToBottom = true;
        });
      }
      lastUserCount = userMsgs;
    });
  }

  ngAfterViewChecked(): void {
    if (!this.stickToBottom) return;
    const el = this.scrollerRef?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }

  protected onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.stickToBottom = distanceFromBottom < 80;
  }

  protected onApply(ev: ApplyCodeBlockEvent): void {
    this.applyCodeBlock.emit(ev);
  }

  protected isOpen(id: string): boolean {
    return this.openDrawers().has(id);
  }

  protected toggleDetails(id: string): void {
    this.openDrawers.update((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected rowClass(m: UiChatMessage): string {
    return m.role === 'user' ? 'flex justify-end' : 'flex justify-start';
  }

  protected bubbleClass(m: UiChatMessage): string {
    const base = 'rounded-xl px-3 py-2 border text-sm leading-relaxed';
    if (m.role === 'user') {
      return `${base} bg-primary/15 border-primary/30 text-foreground self-end`;
    }
    return `${base} bg-secondary border-border text-foreground self-start`;
  }

  //  Formatters 
  protected shortId(id: string): string {
    if (id.startsWith('tmp:')) return id;
    if (id.length <= 12) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }

  protected formatAbsTime(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  }

  protected lineCount(text: string): number {
    if (!text) return 0;
    return text.split('\n').length;
  }

  protected latency(m: UiChatMessage): string | null {
    if (!m.streamingStartedAt) return null;
    const end = m.streamingEndedAt ?? Date.now();
    const ms = end - m.streamingStartedAt;
    if (!Number.isFinite(ms) || ms < 0) return null;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}
