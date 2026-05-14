import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FileRead } from '../../../../core/models/file.model';
import { Icon, Skeleton } from "../../../../shared/ui";
import { MonacoEditor } from "../../../../shared/components/monaco-editor/monaco-editor";

@Component({
  selector: 'file-editor',
  imports: [Icon, MonacoEditor, Skeleton],
  templateUrl: './file-editor.html',
  styleUrl: './file-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-1 min-h-0' },
})
export class FileEditor {
  protected readonly i18n = inject(I18nService);

  readonly file = input<FileRead | null>(null);
  readonly loading = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly language = input<string>('plaintext');
  readonly enableInlineCompletions = input<boolean>(false);
  readonly completionModel = input<string>('qwen2.5-coder:1.5b');
  /** Resolved theme — `vs-dark` / `vs`. Wired from `ThemeService` upstream. */
  readonly monacoTheme = input<'vs-dark' | 'vs'>('vs-dark');
  readonly initialBuffer = input<string | null>(null);

  readonly save = output<string>();
  readonly bufferChange = output<string>();
  /** Fired when the user clicks "AI Edit" in the header. */
  readonly aiEdit = output<void>();

  protected readonly buffer = signal<string>('');

  protected readonly dirty = computed(() => {
    const f = this.file();
    return !!f && this.buffer() !== f.content;
  });

  protected readonly lineCount = computed(() => {
    const v = this.buffer();
    if (!v) return 0;
    return v.split('\n').length;
  });

  constructor() {
    effect(() => {
      const f = this.file();
      const initial = this.initialBuffer();
      if (!f) {
        untracked(() => this.buffer.set(''));
        return;
      }
      const target = initial !== null ? initial : f.content;
      untracked(() => {
        if (this.buffer() !== target) this.buffer.set(target);
      });
    });
  }

  protected onChange(value: string): void {
    this.buffer.set(value);
    this.bufferChange.emit(value);
  }

  protected onSave(): void {
    if (!this.dirty() || this.saving()) return;
    this.save.emit(this.buffer());
  }
}
