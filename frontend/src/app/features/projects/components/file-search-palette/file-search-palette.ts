import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FileTreeEntry } from '../../../../core/models/file.model';
import { IconName, iconForPath } from '../../../../shared/icons';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/ui';
import { SearchApi, SearchHit } from '../../../../core/services/search/search-api.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'file-search-palette',
  imports: [FormsModule, Icon, RouterModule],
  templateUrl: './file-search-palette.html',
  styleUrl: './file-search-palette.css',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class FileSearchPalette implements AfterViewInit {
  readonly open = input<boolean>(false);
  readonly files = input<readonly FileTreeEntry[]>([]);
  readonly projectId = input<string>('');
  readonly close = output<void>();
  readonly selectFile = output<string>();

  @ViewChild('input') private inputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('list') private listRef?: ElementRef<HTMLElement>;

  private readonly searchApi = inject(SearchApi);
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly query = signal<string>('');
  protected readonly selectedIndex = signal<number>(0);

  protected readonly mode = signal<'files' | 'semantic'>('files');
  /** Semantic-mode result list, populated by the debounced effect. */
  protected readonly semanticHits = signal<SearchHit[]>([]);
  protected readonly searching = signal<boolean>(false);
  protected readonly searchError = signal<string>('');

  private semanticSub: Subscription | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly fileResults = computed<FileResult[]>(() =>
    fuzzyMatchFiles(this.files(), this.query()),
  );

  protected readonly results = computed<UnifiedResult[]>(() => {
    if (this.mode() === 'semantic') {
      return this.semanticHits().map((h) => ({
        path: h.path,
        snippet: h.snippet,
        score: h.score,
        startLine: h.start_line,
        endLine: h.end_line,
      }));
    }
    return this.fileResults();
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      untracked(() => {
        this.selectedIndex.set(0);
        queueMicrotask(() => {
          this.inputRef?.nativeElement?.focus();
          this.inputRef?.nativeElement?.select();
        });
      });
    });

    // Keep the selected row visible as the user navigates.
    effect(() => {
      const i = this.selectedIndex();

      this.results();
      queueMicrotask(() => {
        const list = this.listRef?.nativeElement;
        if (!list) return;
        const row = list.querySelector<HTMLElement>(`[data-result-index="${i}"]`);
        row?.scrollIntoView({ block: 'nearest' });
      });
    });

    effect(() => {
      const m = this.mode();
      const q = this.query().trim();
      const pid = this.projectId();
      if (m !== 'semantic' || !pid || !q) {
        untracked(() => {
          this.semanticHits.set([]);
          this.searchError.set('');
          this.searching.set(false);
        });
        this.cancelSemanticRequest();
        return;
      }
      this.cancelSemanticRequest();
      untracked(() => this.scheduleSemanticSearch(pid, q));
    });
  }

  private cancelSemanticRequest(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.semanticSub?.unsubscribe();
    this.semanticSub = null;
  }

  private scheduleSemanticSearch(projectId: string, query: string): void {
    this.searching.set(true);
    this.searchError.set('');
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.semanticSub = this.searchApi
        .search(projectId, { query, mode: 'semantic', limit: 20 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.query !== this.query().trim()) return;
            this.semanticHits.set(res.items);
            this.searching.set(false);
          },
          error: (err) => {
            this.semanticHits.set([]);
            this.searching.set(false);
            this.searchError.set(
              err?.status === 503
                ? this.i18n.t('quickOpen.semanticUnavailable')
                : this.i18n.t('quickOpen.searchFailed'),
            );
          },
        });
    }, 300);
  }

  protected setMode(m: 'files' | 'semantic'): void {
    if (this.mode() === m) return;
    this.mode.set(m);
    this.selectedIndex.set(0);
  }

  ngAfterViewInit(): void {
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
  }

  protected onKeyDown(ev: KeyboardEvent): void {
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        this.move(-1);
        break;
      case 'Tab':
        ev.preventDefault();
        this.move(ev.shiftKey ? -1 : 1);
        break;
      case 'Enter': {
        ev.preventDefault();
        const r = this.results()[this.selectedIndex()];
        if (r) this.onPick(r.path);
        break;
      }
      case 'Escape':
        ev.preventDefault();
        this.close.emit();
        break;
    }
  }

  protected onBackdropClick(ev: MouseEvent): void {
    // The card stops its own clicks; this fires only on the backdrop.
    if (ev.target === ev.currentTarget) this.close.emit();
  }

  protected onPick(path: string): void {
    this.selectFile.emit(path);
    this.close.emit();
  }

  /** Result-row glyph — colour-coded badge per extension. */
  protected iconFor(path: string): IconName {
    return iconForPath(path);
  }

  private move(delta: number): void {
    const n = this.results().length;
    if (n === 0) return;
    const cur = this.selectedIndex();
    this.selectedIndex.set((cur + delta + n) % n);
  }
}

// Match helpers

interface NameSeg {
  text: string;
  hit: boolean;
}

interface FileResult {
  path: string;
  nameSegs: NameSeg[];
  dir: string;
}
export interface UnifiedResult {
  path: string;
  nameSegs?: NameSeg[];
  dir?: string;
  snippet?: string;
  score?: number;
  startLine?: number;
  endLine?: number;
}

const MAX_RESULTS = 50;

function fuzzyMatchFiles(
  files: readonly FileTreeEntry[],
  rawQuery: string,
): FileResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return files
      .filter((f) => !isHidden(f.path))
      .slice()
      .sort((a, b) => basename(a.path).localeCompare(basename(b.path)))
      .slice(0, MAX_RESULTS)
      .map((f) => makeResult(f.path, []));
  }

  type Scored = { file: FileTreeEntry; score: number; nameHits: number[] };
  const scored: Scored[] = [];

  for (const file of files) {
    if (isHidden(file.path)) continue;
    const name = basename(file.path);
    const nameLower = name.toLowerCase();
    const pathLower = file.path.toLowerCase();

    let score = 0;
    let nameHits: number[] = [];

    if (nameLower === q) {
      score = 1000;
      nameHits = rangeIndices(0, name.length);
    } else if (nameLower.startsWith(q)) {
      score = 500;
      nameHits = rangeIndices(0, q.length);
    } else if (nameLower.includes(q)) {
      score = 200;
      const start = nameLower.indexOf(q);
      nameHits = rangeIndices(start, start + q.length);
    } else if (pathLower.includes(q)) {
      score = 100;
      // Match landed in the path, not the name — leave nameHits empty.
    } else {
      const sub = subsequenceHits(nameLower, q);
      if (sub) {
        score = 50;
        nameHits = sub;
      } else if (subsequenceHits(pathLower, q)) {
        score = 25;
      }
    }

    if (score > 0) {
      scored.push({ file, score, nameHits });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.file.path.length - b.file.path.length ||
      a.file.path.localeCompare(b.file.path),
  );

  return scored
    .slice(0, MAX_RESULTS)
    .map((s) => makeResult(s.file.path, s.nameHits));
}

function subsequenceHits(haystack: string, needle: string): number[] | null {
  const hits: number[] = [];
  let j = 0;
  for (let i = 0; i < haystack.length && j < needle.length; i++) {
    if (haystack[i] === needle[j]) {
      hits.push(i);
      j++;
    }
  }
  return j === needle.length ? hits : null;
}

function rangeIndices(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

function makeResult(path: string, nameHits: number[]): FileResult {
  const name = basename(path);
  const dir = dirname(path);
  const hitSet = new Set(nameHits);
  const segs: NameSeg[] = [];
  let i = 0;
  while (i < name.length) {
    const hit = hitSet.has(i);
    let j = i + 1;
    while (j < name.length && hitSet.has(j) === hit) j++;
    segs.push({ text: name.slice(i, j), hit });
    i = j;
  }
  return { path, nameSegs: segs, dir };
}

function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
}

function dirname(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

function isHidden(path: string): boolean {
  return path.endsWith('.gitkeep') || path === '.gitkeep';
}
