import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FilesApi } from '../../../../core/services/files/files-api.service';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { selectAllFiles, FilesActions } from '../../../../core/state/files';
import { Modal, Skeleton, Button } from "../../../../shared/ui";
import { FormsModule } from '@angular/forms';
import { MonacoDiff } from "../../../../shared/components/monaco-diff/monaco-diff";

export interface ApplyDiffProposal {
  projectId: string;
  path: string;
  proposed: string;
  language: string;
}

type InsertMode = 'replace' | 'append' | 'prepend' | 'insert';

@Component({
  selector: 'apply-diff-modal',
  imports: [Modal, FormsModule, Skeleton, MonacoDiff, Button],
  templateUrl: './apply-diff-modal.html',
  styleUrl: './apply-diff-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyDiffModal {
  readonly open = input<boolean>(false);
  readonly proposal = input<ApplyDiffProposal | null>(null);
  readonly close = output<void>();
  readonly applied = output<ApplyDiffProposal>();

  private readonly store = inject(Store);
  private readonly filesApi = inject(FilesApi);
  protected readonly themeSvc = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  private readonly entries = this.store.selectSignal(selectAllFiles);

  protected readonly current = signal<string>('');
  protected readonly loadingCurrent = signal<boolean>(false);
  protected readonly loadError = signal<string>('');

  /** Active insert strategy. Resets when a new proposal arrives. */
  protected readonly mode = signal<InsertMode>('replace');
  /** Target line for "insert" mode (0-based; code goes *after* this line). */
  protected readonly insertLine = signal<number>(0);

  protected readonly modes: { value: InsertMode; labelKey: string; descriptionKey: string }[] = [
    {
      value: 'replace',
      labelKey: 'applyDiff.modeReplace',
      descriptionKey: 'applyDiff.modeReplaceDesc',
    },
    {
      value: 'append',
      labelKey: 'applyDiff.modeAppend',
      descriptionKey: 'applyDiff.modeAppendDesc',
    },
    {
      value: 'prepend',
      labelKey: 'applyDiff.modePrepend',
      descriptionKey: 'applyDiff.modePrependDesc',
    },
    {
      value: 'insert',
      labelKey: 'applyDiff.modeInsert',
      descriptionKey: 'applyDiff.modeInsertDesc',
    },
  ];

  /** True when the path already exists in the cached tree. */
  protected readonly exists = computed(() => {
    const p = this.proposal();
    if (!p) return false;
    return this.entries().some((e) => e.path === p.path);
  });

  /** Number of lines in the current file (for the line-picker max). */
  protected readonly lineCount = computed(() => {
    const c = this.current();
    return c ? c.split('\n').length : 0;
  });

  protected readonly finalContent = computed<string>(() => {
    const proposed = this.proposal()?.proposed ?? '';
    const current = this.current();
    switch (this.mode()) {
      case 'append':
        return current ? `${current}\n${proposed}` : proposed;
      case 'prepend':
        return current ? `${proposed}\n${current}` : proposed;
      case 'insert': {
        if (!current) return proposed;
        const lines = current.split('\n');
        const at = Math.max(0, Math.min(this.insertLine(), lines.length));
        lines.splice(at, 0, proposed);
        return lines.join('\n');
      }
      default:
        return proposed;
    }
  });

  protected readonly title = computed(() => {
    const p = this.proposal();
    if (!p) return this.i18n.t('applyDiff.titleDefault');
    if (!this.exists()) return this.i18n.t('applyDiff.titleCreate');
    return this.i18n.t('applyDiff.titleApply');
  });

  protected readonly applyLabel = computed(() => {
    if (!this.exists()) return this.i18n.t('applyDiff.applyCreate');
    switch (this.mode()) {
      case 'append':
        return this.i18n.t('applyDiff.applyAppend');
      case 'prepend':
        return this.i18n.t('applyDiff.applyPrepend');
      case 'insert':
        return this.i18n.t('applyDiff.applyInsert');
      default:
        return this.i18n.t('applyDiff.applyReplace');
    }
  });

  constructor() {
    effect(() => {
      const p = this.proposal();
      const isOpen = this.open();
      if (!isOpen || !p) {
        untracked(() => {
          this.current.set('');
          this.loadingCurrent.set(false);
          this.loadError.set('');
          this.mode.set('replace');
          this.insertLine.set(0);
        });
        return;
      }
      untracked(() => {
        const exists = this.exists();
        this.mode.set(exists ? 'append' : 'replace');
        this.insertLine.set(0);
        this.fetchCurrent(p);
      });
    });
  }

  protected setInsertLine(value: unknown): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.insertLine.set(Math.max(0, Math.floor(n)));
  }

  private fetchCurrent(p: ApplyDiffProposal): void {
    if (!this.exists()) {
      this.current.set('');
      this.loadError.set('');
      return;
    }
    this.loadingCurrent.set(true);
    this.loadError.set('');
    this.filesApi.read(p.projectId, p.path).subscribe({
      next: (file) => {
        this.current.set(file.content);
        this.loadingCurrent.set(false);
      },
      error: () => {
        this.current.set('');
        this.loadingCurrent.set(false);
      },
    });
  }

  protected apply(): void {
    const p = this.proposal();
    if (!p) return;
    this.store.dispatch(
      FilesActions.upsertFile({
        projectId: p.projectId,
        path: p.path,
        content: this.finalContent(),
      }),
    );
    this.applied.emit(p);
    this.close.emit();
  }

  protected cancel(): void {
    this.close.emit();
  }
}
