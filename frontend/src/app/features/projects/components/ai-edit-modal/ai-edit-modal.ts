import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FileRead } from '../../../../core/models/file.model';
import { ChatApi } from '../../../../core/services/chat/chat-api.service';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { Modal, Button, Icon } from "../../../../shared/ui";
import { FormsModule } from '@angular/forms';
import { MonacoDiff } from "../../../../shared/components/monaco-diff/monaco-diff";

@Component({
  selector: 'ai-edit-modal',
  imports: [Modal, Button, Icon, FormsModule, MonacoDiff],
  templateUrl: './ai-edit-modal.html',
  styleUrl: './ai-edit-modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush,

})
export class AiEditModal {
  readonly open = input<boolean>(false);
  readonly projectId = input<string>('');
  readonly file = input<FileRead | null>(null);
  /** Model id from the workspace's model selector (falls back to backend default). */
  readonly model = input<string>('');

  readonly close = output<void>();
  readonly applied = output<{ path: string; content: string }>();

  private readonly chatApi = inject(ChatApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly themeSvc = inject(ThemeService);
  protected readonly i18n = inject(I18nService);

  protected readonly phase = signal<'prompt' | 'streaming' | 'review' | 'error'>(
    'prompt',
  );
  protected readonly prompt = signal<string>('');
  protected readonly streamed = signal<string>('');
  protected readonly errorMsg = signal<string>('');

  private currentStream: Subscription | null = null;

  protected readonly canGenerate = computed(
    () => this.prompt().trim().length > 0 && !!this.file(),
  );

  protected readonly title = computed(() => {
    const f = this.file();
    return f
      ? this.i18n.t('aiEdit.titleFor', { file: basename(f.path) })
      : this.i18n.t('aiEdit.titleGeneric');
  });

  protected readonly examplePlaceholder = computed(() => {
    const f = this.file();
    if (!f) return 'Describe the change...';
    const lang = languageHint(f.path);
    if (lang === 'typescript' || lang === 'javascript') {
      return 'Add input validation to the handler · Rename the helper to camelCase · Add JSDoc on every public function';
    }
    if (lang === 'python') {
      return 'Add type hints · Rewrite this as an async function · Split the main loop into helpers';
    }
    return 'Add error handling · Reorganise the imports · Convert tabs to spaces';
  });

  protected readonly language = computed(() => {
    const f = this.file();
    return f ? languageHint(f.path) : 'plaintext';
  });

  /** The model's response, stripped to just the code block contents. */
  protected readonly proposed = computed<string>(() =>
    extractCodeBody(this.streamed()),
  );

  protected readonly proposedTrimmed = computed(() => this.proposed().trim());

  constructor() {
    // Reset everything when the modal closes — a re-open starts fresh.
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) {
        untracked(() => this.resetState());
      }
    });
  }

  protected generate(): void {
    if (!this.canGenerate()) return;
    const f = this.file();
    if (!f) return;
    const projectId = this.projectId();
    if (!projectId) {
      this.fail(this.i18n.t('aiEdit.missingProject'));
      return;
    }

    this.errorMsg.set('');
    this.streamed.set('');
    this.phase.set('streaming');

    const userPrompt = this.prompt().trim();
    const composed =
      `You are editing the file \`${f.path}\`.\n\n` +
      `The user wants this change:\n${userPrompt}\n\n` +
      `Output the COMPLETE new content of \`${f.path}\` inside a single ` +
      "triple-backtick fenced code block. Do not include any explanation, " +
      'commentary, or text outside the code block.';

    this.currentStream = this.chatApi
      .streamProjectChat(projectId, {
        model: this.model(),
        user_query: composed,
        file_paths: [f.path],
        session_id: null,
        use_web_search: false,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          switch (event.kind) {
            case 'token':
              this.streamed.update((s) => s + event.token);
              break;
            case 'done':
              this.phase.set('review');
              break;
            case 'error':
              this.fail(event.error || this.i18n.t('aiEdit.streamError'));
              break;
          }
        },
        error: (err) => this.fail(extractError(err)),
      });
  }

  protected abort(): void {
    this.currentStream?.unsubscribe();
    this.currentStream = null;
    if (this.streamed().trim().length === 0) {
      this.phase.set('prompt');
    } else {
      this.phase.set('review');
    }
  }

  protected apply(): void {
    const f = this.file();
    const next = this.proposedTrimmed();
    if (!f || !next) return;
    this.applied.emit({ path: f.path, content: next });
    this.close.emit();
  }

  protected cancel(): void {
    this.currentStream?.unsubscribe();
    this.currentStream = null;
    this.close.emit();
  }

  private fail(msg: string): void {
    this.errorMsg.set(msg);
    this.phase.set('error');
  }

  private resetState(): void {
    this.currentStream?.unsubscribe();
    this.currentStream = null;
    this.phase.set('prompt');
    this.prompt.set('');
    this.streamed.set('');
    this.errorMsg.set('');
  }
}

// Helpers

function extractCodeBody(raw: string): string {
  if (!raw) return '';
  const fence = /```[^\n]*\n([\s\S]*?)(?:\n```|$)/;
  const m = fence.exec(raw);
  if (m) return m[1] ?? '';
  return raw;
}

function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
}

/** Minimal duplicate of the workspace's language detector. */
const EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java',
  html: 'html', css: 'css', scss: 'scss',
  json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
  sh: 'shell', sql: 'sql', xml: 'xml', toml: 'ini',
};
function languageHint(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  return EXT[path.slice(dot + 1).toLowerCase()] ?? 'plaintext';
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Generation failed.';
}
