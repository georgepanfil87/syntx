import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';

import { loadMonaco } from './monaco-loader';
import { CompletionsApiService } from '../../../core/services/completions-api/completions-api.service';

type MonacoNamespace = typeof import('monaco-editor');

let inlineCompletionsRegistered = false;

@Component({
  selector: 'monaco-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="w-full h-full"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
})
export class MonacoEditor implements AfterViewInit, OnDestroy {
  readonly value = input<string>('');
  readonly language = input<string>('plaintext');
  readonly theme = input<'vs-dark' | 'vs'>('vs-dark');
  readonly readOnly = input<boolean>(false);
  readonly enableInlineCompletions = input<boolean>(false);
  readonly completionModel = input<string>('qwen2.5-coder:1.5b');

  readonly valueChange = output<string>();
  readonly save = output<void>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private readonly completions = inject(CompletionsApiService);

  private monaco: MonacoNamespace | null = null;
  private editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
  private inflight: AbortController | null = null;
  private writingFromInput = false;

  constructor() {
    effect(() => {
      const v = this.value();
      untracked(() => this.applyValue(v));
    });
    effect(() => {
      const lang = this.language();
      untracked(() => this.applyLanguage(lang));
    });
    effect(() => {
      const t = this.theme();
      untracked(() => this.applyTheme(t));
    });
    effect(() => {
      const ro = this.readOnly();
      untracked(() => this.applyReadOnly(ro));
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.zone.runOutsideAngular(() => this.create());
  }

  ngOnDestroy(): void {
    this.inflight?.abort();
    this.editor?.getModel()?.dispose();
    this.editor?.dispose();
    this.editor = null;
  }

  private async create(): Promise<void> {
    const monaco = await loadMonaco();
    this.monaco = monaco;

    if (!inlineCompletionsRegistered) {
      monaco.languages.registerInlineCompletionsProvider('*', {
        provideInlineCompletions: (
          model: import('monaco-editor').editor.ITextModel,
          position: import('monaco-editor').Position,
          context: import('monaco-editor').languages.InlineCompletionContext,
        ) => this.provideInline(model, position, context),
        freeInlineCompletions: () => {},
      } as never);
      inlineCompletionsRegistered = true;
    }

    this.editor = monaco.editor.create(this.hostRef.nativeElement, {
      value: this.value(),
      language: this.language(),
      theme: this.theme(),
      readOnly: this.readOnly(),
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 20,
      tabSize: 2,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      padding: { top: 12, bottom: 12 },
      inlineSuggest: { enabled: this.enableInlineCompletions() },
      renderLineHighlight: 'gutter',
      occurrencesHighlight: 'off',
    });

    this.editor.onDidChangeModelContent(() => {
      if (this.writingFromInput) return;
      const v = this.editor?.getValue() ?? '';
      this.zone.run(() => this.valueChange.emit(v));
    });

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      this.zone.run(() => this.save.emit()),
    );

    const triggerInline = () => {
      this.editor?.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
    };
    this.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Backslash, triggerInline);
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, triggerInline);
  }

  //  Reactive setters
  private applyValue(v: string): void {
    if (!this.editor) return;
    if (this.editor.getValue() === v) return;
    this.writingFromInput = true;
    this.editor.setValue(v);
    this.writingFromInput = false;
  }

  private applyLanguage(lang: string): void {
    const m = this.editor?.getModel();
    if (!m || !this.monaco) return;
    this.monaco.editor.setModelLanguage(m, lang || 'plaintext');
  }

  private applyTheme(t: 'vs-dark' | 'vs'): void {
    this.monaco?.editor.setTheme(t);
  }

  private applyReadOnly(ro: boolean): void {
    this.editor?.updateOptions({ readOnly: ro });
  }

  //  Inline completions provider
  private async provideInline(
    model: import('monaco-editor').editor.ITextModel,
    position: import('monaco-editor').Position,
    context?: import('monaco-editor').languages.InlineCompletionContext,
  ): Promise<import('monaco-editor').languages.InlineCompletions> {
    const isExplicit = context?.triggerKind === 1;
    if (!isExplicit && !this.enableInlineCompletions()) return { items: [] };

    this.inflight?.abort();
    const controller = new AbortController();
    this.inflight = controller;

    const offset = model.getOffsetAt(position);
    const text = model.getValue();
    const prefix = text.slice(0, offset);
    const suffix = text.slice(offset);
    if (prefix.trim().length === 0) return { items: [] };

    try {
      const res = await new Promise<{ completion: string }>((resolve, reject) => {
        const sub = this.completions
          .complete({
            model: this.completionModel(),
            prefix,
            suffix,
            language: this.language(),
          })
          .subscribe({
            next: (r) => resolve(r),
            error: reject,
          });
        controller.signal.addEventListener('abort', () => sub.unsubscribe());
      });
      if (controller.signal.aborted || !res.completion) return { items: [] };
      return {
        items: [
          {
            insertText: res.completion,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          },
        ],
      };
    } catch {
      return { items: [] };
    }
  }
}
