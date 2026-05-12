import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  input,
} from '@angular/core';

import { loadMonaco } from '../monaco-editor/monaco-loader';

@Component({
  selector: 'code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pre #host class="font-mono text-[11px] leading-snug p-3 overflow-x-auto bg-background m-0">{{
      body()
    }}</pre>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      :host ::ng-deep pre .mtk1 {
        color: hsl(var(--foreground));
      }
    `,
  ],
})
export class CodeBlock {
  readonly body = input.required<string>();
  readonly language = input<string>('');

  @ViewChild('host', { static: true })
  private hostRef!: ElementRef<HTMLPreElement>;

  constructor() {
    effect(() => {
      const body = this.body();
      const lang = normaliseLanguage(this.language());
      const target = this.hostRef.nativeElement;

      target.textContent = body;
      if (!body) return;

      void loadMonaco().then((monaco) => {
        if (target.textContent !== body) return;
        try {
          monaco.editor
            .colorize(body, lang || 'plaintext', { tabSize: 2 })
            .then((html) => {
              if (target.textContent !== body) return;
              target.innerHTML = html;
            })
            .catch(() => {});
        } catch {}
      });
    });
  }
}

function normaliseLanguage(lang: string): string {
  const l = lang.trim().toLowerCase();
  switch (l) {
    case 'js':
    case 'jsx':
    case 'node':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'yml':
      return 'yaml';
    case 'md':
      return 'markdown';
    case 'rs':
      return 'rust';
    case 'rb':
      return 'ruby';
    case '':
      return 'plaintext';
    default:
      return l;
  }
}
