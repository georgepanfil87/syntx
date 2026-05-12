import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { IconName, iconForPath } from '../../../../shared/icons';
import { Icon, Button } from "../../../../shared/ui";
import { FormsModule } from '@angular/forms';
import { MonacoDiff } from "../../../../shared/components/monaco-diff/monaco-diff";
import { CommitRef, DiffResponse, GitApi, StatusResponse } from '../../../../core/services/git/git-api.service';

@Component({
  selector: 'git-panel',
  imports: [Icon, FormsModule, Button, MonacoDiff],
  templateUrl: './git-panel.html',
  styleUrl: './git-panel.css',
  host: { class: 'flex flex-col h-full min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GitPanel {
  readonly projectId = input<string>('');
  readonly committed = output<void>();

  private readonly gitApi = inject(GitApi);
  private readonly toasts = inject(ToastService);
  protected readonly themeSvc = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  //  Tab + form state 
  protected readonly tab = signal<'status' | 'history'>('status');
  protected readonly message = signal<string>('');

  // Data + loading flags
  protected readonly statusData = signal<StatusResponse | null>(null);
  protected readonly loadingStatus = signal<boolean>(false);
  protected readonly committing = signal<boolean>(false);

  protected readonly commits = signal<CommitRef[]>([]);
  protected readonly loadingLog = signal<boolean>(false);

  protected readonly selectedCommitId = signal<string | null>(null);
  protected readonly selectedFiles = signal<{ path: string; size_bytes: number }[]>([]);
  protected readonly loadingDetail = signal<boolean>(false);

  protected readonly selectedFile = signal<string | null>(null);
  protected readonly diff = signal<DiffResponse | null>(null);
  protected readonly loadingDiff = signal<boolean>(false);

  protected readonly canCommit = computed(
    () => this.message().trim().length > 0 && !this.committing() && !!this.projectId(),
  );

  constructor() {
    effect(() => {
      const pid = this.projectId();
      if (!pid) {
        untracked(() => this.resetTransient());
        return;
      }
      untracked(() => {
        this.resetTransient();
        this.loadStatus(pid);
        this.loadLog(pid);
      });
    });
  }

  protected setTab(t: 'status' | 'history'): void {
    this.tab.set(t);
  }

  protected onCommit(): void {
    const pid = this.projectId();
    const msg = this.message().trim();
    if (!pid || !msg || this.committing()) return;
    this.committing.set(true);
    this.gitApi
      .commit(pid, msg)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.committing.set(false);
          this.message.set('');
          this.toasts.success(this.i18n.t('git.commitCreated'));
          this.committed.emit();
          // Refresh both panes so the new commit shows up.
          this.loadStatus(pid);
          this.loadLog(pid);
        },
        error: (err) => {
          this.committing.set(false);
          this.toasts.error(this.i18n.t('git.commitFailed'), {
            detail: err?.error?.detail ?? `HTTP ${err?.status ?? '?'}`,
          });
        },
      });
  }

  protected selectCommit(c: CommitRef): void {
    if (this.selectedCommitId() === c.id) return;
    this.selectedCommitId.set(c.id);
    this.selectedFile.set(null);
    this.diff.set(null);
    this.loadingDetail.set(true);
    const pid = this.projectId();
    this.gitApi
      .detail(pid, c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.selectedFiles.set(d.files);
          this.loadingDetail.set(false);
        },
        error: () => {
          this.selectedFiles.set([]);
          this.loadingDetail.set(false);
        },
      });
  }

  protected selectFile(path: string): void {
    const pid = this.projectId();
    const cid = this.selectedCommitId();
    if (!pid || !cid) return;
    this.selectedFile.set(path);
    this.diff.set(null);
    this.loadingDiff.set(true);
    this.gitApi
      .diff(pid, cid, path)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.diff.set(d);
          this.loadingDiff.set(false);
        },
        error: () => {
          this.loadingDiff.set(false);
        },
      });
  }

  protected backToFiles(): void {
    this.selectedFile.set(null);
    this.diff.set(null);
  }

  /** Per-file glyph for the commit detail file list. */
  protected iconFor(path: string): IconName {
    return iconForPath(path);
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  protected languageFromPath(path: string): string {
    const dot = path.lastIndexOf('.');
    if (dot < 0) return 'plaintext';
    const ext = path.slice(dot + 1).toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
      sh: 'shell',
      sql: 'sql',
      xml: 'xml',
      toml: 'ini',
    };
    return map[ext] ?? 'plaintext';
  }

  private loadStatus(projectId: string): void {
    this.loadingStatus.set(true);
    this.gitApi
      .status(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.statusData.set(s);
          this.loadingStatus.set(false);
        },
        error: () => this.loadingStatus.set(false),
      });
  }

  private loadLog(projectId: string): void {
    this.loadingLog.set(true);
    this.gitApi
      .log(projectId, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.commits.set(r.items);
          this.loadingLog.set(false);
        },
        error: () => this.loadingLog.set(false),
      });
  }

  private resetTransient(): void {
    this.tab.set('status');
    this.message.set('');
    this.selectedCommitId.set(null);
    this.selectedFile.set(null);
    this.diff.set(null);
    this.selectedFiles.set([]);
  }
}
