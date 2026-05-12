import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { Icon } from '../../../../shared/ui';
import { CodeBlock } from '../../../../shared/components';

export interface ApplyCodeBlockEvent {
  path: string;
  language: string;
  content: string;
}

interface ContentBlock {
  kind: 'text' | 'code';
  language?: string;
  path?: string;
  body: string;
}

@Component({
  selector: 'message-content',
  imports: [Icon, CodeBlock],
  templateUrl: './message-content.html',
  styleUrl: './message-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageContent {
  readonly content = input.required<string>();
  readonly openFilePath = input<string | null>(null);
  readonly applyCodeBlock = output<ApplyCodeBlockEvent>();

  private readonly toasts = inject(ToastService);

  protected readonly blocks = computed<ContentBlock[]>(() => parseBlocks(this.content()));

  protected onApply(block: ContentBlock, path: string): void {
    if (!path) return;
    this.applyCodeBlock.emit({
      path,
      language: block.language ?? '',
      content: block.body,
    });
  }

  protected async onCopy(block: ContentBlock): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.toasts.error('Copy unavailable', { detail: 'Clipboard API blocked.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(block.body);
      this.toasts.success('Copied to clipboard');
    } catch {
      this.toasts.error('Copy failed');
    }
  }

  /** Per-call inline-segment parser for text blocks. Cheap enough at our scale. */
  protected parseInline(text: string): InlineSegment[] {
    return parseInlineSegments(text);
  }
}

interface InlineSegment {
  kind: 'text' | 'bold' | 'italic' | 'code';
  body: string;
}

const INLINE_RE =
  /`([^`\n]+?)`|\*\*([^*\n][^*]*?[^*\n]|[^*\n])\*\*|\*([^*\n][^*]*?[^*\n]|[^*\n])\*/g;

function parseInlineSegments(text: string): InlineSegment[] {
  if (!text) return [];
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > last) {
      out.push({ kind: 'text', body: text.slice(last, start) });
    }
    if (m[1] !== undefined) {
      out.push({ kind: 'code', body: m[1] });
    } else if (m[2] !== undefined) {
      out.push({ kind: 'bold', body: m[2] });
    } else if (m[3] !== undefined) {
      out.push({ kind: 'italic', body: m[3] });
    }
    last = start + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: 'text', body: text.slice(last) });
  }
  return out;
}

const FENCE_RE = /(^|\n)```([^\n]*)\n([\s\S]*?)\n```(?=\n|$)/g;

const PATH_COMMENT_RE =
  /^\s*(?:\/\/|\/\*+|#|--|<!--)\s*(?:(?:path|file)\s*[:=]\s*|@)(\S+?)\s*(?:\*+\/|-->)?\s*$/i;

function parseBlocks(content: string): ContentBlock[] {
  if (!content) return [];
  const out: ContentBlock[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(FENCE_RE)) {
    const fenceStart = (match.index ?? 0) + (match[1] ? match[1].length : 0);
    const before = content.slice(lastIndex, fenceStart);
    if (before.trim().length > 0) {
      out.push({ kind: 'text', body: trimBlankLines(before) });
    }
    const header = (match[2] ?? '').trim();
    const rawBody = match[3] ?? '';
    const { language, path: hintPath } = parseFenceHeader(header);
    let body = rawBody;
    let path = hintPath;
    if (!path) {
      const firstNl = rawBody.indexOf('\n');
      const firstLine = firstNl < 0 ? rawBody : rawBody.slice(0, firstNl);
      const cm = PATH_COMMENT_RE.exec(firstLine);
      if (cm) {
        path = cm[1];
        body = firstNl < 0 ? '' : rawBody.slice(firstNl + 1);
      }
    }
    out.push({ kind: 'code', language, path: path ? normalizePath(path) : undefined, body });
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  const tail = content.slice(lastIndex);
  if (tail.trim().length > 0) {
    out.push({ kind: 'text', body: trimBlankLines(tail) });
  }
  return out;
}

function normalizePath(raw: string): string {
  let s = raw.trim();

  s = s.replace(/^(?:path|file)\s*[:=]\s*/i, '');

  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' || first === "'" || first === '`') && first === last) {
      s = s.slice(1, -1);
    }
  }
  if (s.startsWith('@')) s = s.slice(1);
  while (s.startsWith('./')) s = s.slice(2);
  while (s.startsWith('/')) s = s.slice(1);
  s = s.replace(/[.,:;]+$/, '');
  return s;
}

function parseFenceHeader(header: string): { language: string; path?: string } {
  if (!header) return { language: '' };
  const parts = header.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { language: '' };

  const looksLikeKv = (token: string) => /^(?:path|file)\s*[:=]/i.test(token);
  if (parts.length === 1) {
    if (looksLikeKv(parts[0])) {
      return { language: '', path: parts[0] };
    }
    return /[/.]/.test(parts[0]) ? { language: '', path: parts[0] } : { language: parts[0] };
  }
  if (looksLikeKv(parts[0])) {
    return { language: '', path: parts.join(' ') };
  }
  return { language: parts[0], path: parts.slice(1).join(' ') };
}

function trimBlankLines(s: string): string {
  return s.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
}
