import {
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
import { ModelRef } from '../../../../core/models/ai.model';
import { FormsModule } from '@angular/forms';
import { Icon } from "../../../../shared/ui";

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT_PX = 24;
const MAX_AUTOCOMPLETE = 8;

const MENTION_RE = /@([A-Za-z0-9_./-]+[A-Za-z0-9_])/g;

export interface ChatSendPayload {
  text: string;
  filePaths: string[];
  useWebSearch: boolean;
  model: string;
}

@Component({
  selector: 'chat-composer',
  imports: [FormsModule, Icon],
  templateUrl: './chat-composer.html',
  styleUrl: './chat-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComposer {
  protected readonly i18n = inject(I18nService);

  readonly streaming = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Ask anything about this project…');

  readonly availableFiles = input<readonly string[]>([]);
  readonly openFilePath = input<string | null>(null);
  readonly webSearchAvailable = input<boolean>(false);

  readonly availableModels = input<readonly ModelRef[]>([]);
  readonly defaultModel = input<string>('');
  readonly modelsLoading = input<boolean>(false);
  readonly contextFiles = input<readonly string[]>([]);

  readonly send = output<ChatSendPayload>();
  readonly abort = output<void>();
  /** User clicked the X on a context pill — drop just that path. */
  readonly removeContextFile = output<string>();
  /** User clicked "clear all" — drop every context path. */
  readonly clearContextFiles = output<void>();

  protected readonly value = signal<string>('');

  protected readonly selectedModel = signal<string>('');
  private readonly caret = signal<number>(0);
  protected readonly highlightIdx = signal<number>(0);
  protected readonly isDropTarget = signal<boolean>(false);

  protected readonly webSearchOn = signal<boolean>(false);

  constructor() {
    effect(() => {
      const def = this.defaultModel();
      if (!def) return;
      untracked(() => {
        if (!this.selectedModel()) this.selectedModel.set(def);
      });
    });
  }

  protected readonly dropPlaceholder = computed(() =>
    this.isDropTarget() ? 'Drop the file here to attach it as @mention' : this.placeholder(),
  );

  // Display constants exposed to the template (avoids `Math` calls in HTML).
  protected readonly MIN_ROWS = MIN_ROWS;
  protected readonly minHeightPx = MIN_ROWS * LINE_HEIGHT_PX;
  protected readonly maxHeightPx = MAX_ROWS * LINE_HEIGHT_PX;

  @ViewChild('ta') private taRef?: ElementRef<HTMLTextAreaElement>;

  protected readonly mentionContext = computed<MentionCtx | null>(() => {
    const text = this.value();
    const caret = this.caret();
    if (caret <= 0) return null;
    // Look back from the caret for `@` not preceded by an identifier
    // char. The character class matches what MENTION_RE accepts.
    let i = caret - 1;
    while (i >= 0 && /[A-Za-z0-9_./-]/.test(text[i] ?? '')) i--;
    if (text[i] !== '@') return null;
    const start = i; // position of '@'
    // Reject `email@` style — the '@' must be preceded by start-of-text
    // or whitespace / punctuation, not an alphanumeric.
    const prev = start > 0 ? text[start - 1] : '';
    if (prev && /[A-Za-z0-9]/.test(prev)) return null;
    const partial = text.slice(start + 1, caret);
    return { start, end: caret, partial };
  });

  /** Filtered + ranked suggestions. */
  protected readonly suggestions = computed<string[]>(() => {
    const ctx = this.mentionContext();
    if (!ctx) return [];
    const q = ctx.partial.toLowerCase();
    const all = this.availableFiles();
    if (!q) return all.slice(0, MAX_AUTOCOMPLETE);
    type Scored = { path: string; score: number };
    const scored: Scored[] = [];
    for (const path of all) {
      const lower = path.toLowerCase();
      let score = 0;
      if (lower.startsWith(q)) score = 3;
      else if (lower.includes(`/${q}`)) score = 2;
      else if (lower.includes(q)) score = 1;
      if (score > 0) scored.push({ path, score });
    }
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return scored.slice(0, MAX_AUTOCOMPLETE).map((s) => s.path);
  });

  protected readonly showAutocomplete = computed(
    () =>
      this.mentionContext() !== null &&
      this.suggestions().length > 0 &&
      !this.disabled() &&
      !this.streaming(),
  );

  /** Mention paths in the buffer that don't exist in `availableFiles`. */
  protected readonly unknownMentions = computed<string[]>(() => {
    const known = new Set(this.availableFiles());
    const text = this.value();
    const out = new Set<string>();
    for (const match of text.matchAll(MENTION_RE)) {
      const path = match[1];
      if (!known.has(path)) out.add(path);
    }
    return [...out];
  });

  protected readonly canSend = computed(
    () => this.value().trim().length > 0 && !this.disabled() && !this.streaming(),
  );

  protected readonly knownMentionCount = computed<number>(() => {
    const known = new Set(this.availableFiles());
    const out = new Set<string>();
    for (const match of this.value().matchAll(MENTION_RE)) {
      if (known.has(match[1])) out.add(match[1]);
    }
    return out.size;
  });

  protected readonly estimatedTokens = computed<number>(() => {
    const textTokens = Math.ceil(this.value().length / 4);
    const mentionTokens = this.knownMentionCount() * 200;
    const openFileTokens = this.openFilePath() ? 200 : 0;
    return textTokens + mentionTokens + openFileTokens;
  });

  protected readonly showReceipt = computed<boolean>(
    () => !this.streaming() && this.value().trim().length > 0,
  );

  protected onChange(v: string): void {
    this.value.set(v);
    this.recomputeMentionContext();
    this.resize();
  }

  /** Read the textarea selectionStart and stamp it on the signal. */
  protected recomputeMentionContext(): void {
    const el = this.taRef?.nativeElement;
    if (!el) return;
    this.caret.set(el.selectionStart ?? 0);
    // Reset highlight when suggestions change so a stale index doesn't
    // bleed across queries.
    this.highlightIdx.set(0);
  }

  protected onKeydown(ev: KeyboardEvent): void {
    if (this.showAutocomplete()) {
      switch (ev.key) {
        case 'ArrowDown':
          ev.preventDefault();
          this.moveHighlight(1);
          return;
        case 'ArrowUp':
          ev.preventDefault();
          this.moveHighlight(-1);
          return;
        case 'Tab':
        case 'Enter': {
          const choice = this.suggestions()[this.highlightIdx()];
          if (choice) {
            ev.preventDefault();
            this.applySuggestion(choice);
            return;
          }
          break;
        }
        case 'Escape':
          ev.preventDefault();
          this.dismissAutocomplete();
          return;
      }
    }

    if (ev.key !== 'Enter') return;
    if (ev.shiftKey) return; // newline
    ev.preventDefault();
    this.attemptSend();
  }

  protected onPrimary(): void {
    if (this.streaming()) {
      this.abort.emit();
      return;
    }
    this.attemptSend();
  }

  protected onSuggestionClick(ev: MouseEvent, path: string): void {
    // `mousedown` (not click) so we apply *before* the textarea
    // loses focus — a click handler would race against blur.
    ev.preventDefault();
    this.applySuggestion(path);
  }

  private moveHighlight(delta: number): void {
    const n = this.suggestions().length;
    if (n === 0) return;
    const cur = this.highlightIdx();
    this.highlightIdx.set((cur + delta + n) % n);
  }

  private applySuggestion(path: string): void {
    const ctx = this.mentionContext();
    if (!ctx) return;
    const text = this.value();
    // Replace the partial token with the full path. Append a space
    // so the caret leaves the mention slot — otherwise the dropdown
    // would still consider the user "typing" the mention.
    const next = text.slice(0, ctx.start) + '@' + path + ' ' + text.slice(ctx.end);
    this.value.set(next);
    queueMicrotask(() => {
      const el = this.taRef?.nativeElement;
      if (!el) return;
      const newCaret = ctx.start + 1 + path.length + 1;
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
      this.caret.set(newCaret);
      this.resize();
    });
  }

  private dismissAutocomplete(): void {
    // Trick: reset caret to 0 so mentionContext returns null. The
    // next keystroke will recompute it correctly.
    this.caret.set(0);
  }

  //  Drag & drop 

  protected onDragOver(ev: DragEvent): void {
    if (!ev.dataTransfer) return;
    if (!ev.dataTransfer.types.includes('application/x-syntx-path')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    if (!this.isDropTarget()) this.isDropTarget.set(true);
  }

  protected onDragLeave(ev: DragEvent): void {
    // `dragleave` fires on every child enter as well — only clear
    // the highlight when the cursor actually leaves the wrapper.
    const related = ev.relatedTarget as Node | null;
    const host = ev.currentTarget as HTMLElement;
    if (related && host.contains(related)) return;
    this.isDropTarget.set(false);
  }

  protected onDrop(ev: DragEvent): void {
    this.isDropTarget.set(false);
    const path = ev.dataTransfer?.getData('application/x-syntx-path');
    if (!path) return;
    ev.preventDefault();
    this.insertMentionAtCaret(path);
  }


  private insertMentionAtCaret(path: string): void {
    const el = this.taRef?.nativeElement;
    const text = this.value();
    // If the textarea isn't focused yet, append at the end with a
    // leading space so the mention doesn't fuse onto trailing text.
    let pos = el?.selectionStart ?? text.length;
    if (!el || document.activeElement !== el) {
      pos = text.length;
    }
    const needsLeadSpace = pos > 0 && !/\s/.test(text[pos - 1] ?? '');
    const lead = needsLeadSpace ? ' ' : '';
    const insert = `${lead}@${path} `;
    const next = text.slice(0, pos) + insert + text.slice(pos);
    this.value.set(next);
    queueMicrotask(() => {
      const target = this.taRef?.nativeElement;
      if (!target) return;
      const newCaret = pos + insert.length;
      target.focus();
      target.setSelectionRange(newCaret, newCaret);
      this.caret.set(newCaret);
      this.resize();
    });
  }

  private attemptSend(): void {
    if (!this.canSend()) return;
    const text = this.value().trim();
    const known = new Set(this.availableFiles());
    // Mentions in the message body (one-shot per message).
    const mentioned = uniquePaths(text).filter((p) => known.has(p));
    // Sticky context (rides every message until cleared). Filtered
    // against availableFiles so a stale path that was renamed/deleted
    // since being checked never reaches the wire.
    const context = this.contextFiles().filter((p) => known.has(p));
    // Merge + dedupe — order: mentions first (the user's most-recent
    // intent), then sticky context for stable downstream presentation.
    const filePaths = [...new Set([...mentioned, ...context])];
    const useWebSearch = this.webSearchAvailable() && this.webSearchOn();
    const model = this.selectedModel() || this.defaultModel();
    this.send.emit({ text, filePaths, useWebSearch, model });
    this.value.set('');
    this.caret.set(0);
    this.resize();
  }

  /** Last path segment — used to keep context pills compact. */
  protected basename(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash < 0 ? path : path.slice(slash + 1);
  }

  protected toggleWebSearch(): void {
    this.webSearchOn.update((v) => !v);
  }

  private resize(): void {
    const el = this.taRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, this.maxHeightPx);
    el.style.height = `${Math.max(next, this.minHeightPx)}px`;
  }
}

interface MentionCtx {
  /** Index of the leading `@`. */
  start: number;
  /** Index just past the partial path (== caret position). */
  end: number;
  /** Path fragment after the `@`, may be empty. */
  partial: string;
}

function uniquePaths(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    out.add(match[1]);
  }
  return [...out];
}
