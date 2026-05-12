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
  untracked,
} from '@angular/core';

import { loadMonaco } from '../monaco-editor/monaco-loader';

type MonacoNamespace = typeof import('monaco-editor');

@Component({
  selector: 'monaco-diff',
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
export class MonacoDiff implements AfterViewInit, OnDestroy {
  readonly original = input<string>('');
  readonly modified = input<string>('');
  readonly language = input<string>('plaintext');
  readonly theme = input<'vs-dark' | 'vs'>('vs-dark');
  readonly sideBySide = input<boolean>(true);
  readonly readOnly = input<boolean>(true);

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);

  private monaco: MonacoNamespace | null = null;
  private editor: import('monaco-editor').editor.IStandaloneDiffEditor | null = null;
  private originalModel: import('monaco-editor').editor.ITextModel | null = null;
  private modifiedModel: import('monaco-editor').editor.ITextModel | null = null;

  constructor() {
    effect(() => {
      const o = this.original();
      const m = this.modified();
      untracked(() => this.applyContent(o, m));
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
      const sbs = this.sideBySide();
      untracked(() => this.editor?.updateOptions({ renderSideBySide: sbs }));
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.zone.runOutsideAngular(() => this.create());
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    this.editor = null;
    this.originalModel?.dispose();
    this.modifiedModel?.dispose();
    this.originalModel = null;
    this.modifiedModel = null;
  }

  private async create(): Promise<void> {
    const monaco = await loadMonaco();
    this.monaco = monaco;

    this.originalModel = monaco.editor.createModel(this.original(), this.language());
    this.modifiedModel = monaco.editor.createModel(this.modified(), this.language());

    this.editor = monaco.editor.createDiffEditor(this.hostRef.nativeElement, {
      theme: this.theme(),
      readOnly: this.readOnly(),
      automaticLayout: true,
      renderSideBySide: this.sideBySide(),

      hideUnchangedRegions: { enabled: false },
      enableSplitViewResizing: true,
      originalEditable: false,
      ignoreTrimWhitespace: false,
      renderOverviewRuler: true,
      inlineSuggest: { enabled: false },
      minimap: { enabled: false } as never,
    } as never);

    this.editor.setModel({
      original: this.originalModel,
      modified: this.modifiedModel,
    });
  }

  // Reactive setters
  private applyContent(original: string, modified: string): void {
    if (!this.originalModel || !this.modifiedModel) return;
    if (this.originalModel.getValue() !== original) {
      this.originalModel.setValue(original);
    }
    if (this.modifiedModel.getValue() !== modified) {
      this.modifiedModel.setValue(modified);
    }
  }

  private applyLanguage(lang: string): void {
    if (!this.monaco) return;
    if (this.originalModel) {
      this.monaco.editor.setModelLanguage(this.originalModel, lang || 'plaintext');
    }
    if (this.modifiedModel) {
      this.monaco.editor.setModelLanguage(this.modifiedModel, lang || 'plaintext');
    }
  }

  private applyTheme(t: 'vs-dark' | 'vs'): void {
    this.monaco?.editor.setTheme(t);
  }
}
