import { Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, ViewChild } from '@angular/core';
import { Logo, Icon, Button, Resizer, IconName } from '../../../../shared/ui';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { LANGUAGES, Lang } from '../../../../core/i18n/dictionaries';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ChatSessionRef } from '../../../../core/models/chat.model';
import { FileRead } from '../../../../core/models/file.model';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog/confirm-dialog.service';
import { PreferencesService, TREE_PANE_MIN, TREE_PANE_MAX, CHAT_PANE_MIN, CHAT_PANE_MAX } from '../../../../core/services/preferences/preferences.service';
import { ProjectExportImportService } from '../../../../core/services/projects/project-export-import.service';
import { KeyboardShortcutsService } from '../../../../core/services/shortcuts/keyboard-shortcuts.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { selectAllSessions, selectLoadingSessions, selectActiveSessionId, selectActiveSession, selectChatPendingIds, selectAllMessages, selectChatLoadingMessages, selectChatStreaming, ChatActions } from '../../../../core/state/chat';
import { selectAllFiles, selectFilesLoading, selectFilesIsEmpty, selectFilesSaving, selectFilesDeletingPaths, selectFilesRenamingPaths, FilesActions } from '../../../../core/state/files';
import { selectProjectById, selectIsProjectPending, selectIsProjectNotFound, ProjectsActions } from '../../../../core/state/projects';
import { iconForPath } from '../../../../shared/icons';
import { AuthService } from '../../../auth/services/auth.service';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { AiFeaturesService } from '../../../../core/services/ai/ai-features.service';
import { ModelsService } from '../../../../core/services/models/models.service';
import { ActivityBar, ActivityView } from "../../../projects/components/activity-bar/activity-bar";
import { FileTree, RenameEvent } from "../../../projects/components/file-tree/file-tree";
import { GitPanel } from "../../../projects/components/git-panel/git-panel";
import { EmptyState } from "../../../../shared/components";
import { FileEditor } from "../../../projects/components/file-editor/file-editor";
import { ChatPane } from "../../../projects/components/chat-pane/chat-pane";
import { TerminalModal } from "../../../projects/components/terminal-modal/terminal-modal";
import { ChatSessionRenameModal } from "../../../projects/components/chat-session-rename-modal/chat-session-rename-modal";
import { ApplyDiffModal, ApplyDiffProposal } from "../../../projects/components/apply-diff-modal/apply-diff-modal";
import { AiEditModal } from "../../../projects/components/ai-edit-modal/ai-edit-modal";
import { FileSearchPalette } from "../../../projects/components/file-search-palette/file-search-palette";
import { ChatSendPayload } from '../../../projects/components/chat-composer/chat-composer';
import { ApplyCodeBlockEvent } from '../../../projects/components/message-content/message-content';

@Component({
  selector: 'app-project-workspace',
  imports: [Logo, Icon, Button, Resizer, ActivityBar, FileTree, GitPanel, EmptyState, FileEditor, ChatPane, TerminalModal, ChatSessionRenameModal, ApplyDiffModal, AiEditModal, FileSearchPalette],
  templateUrl: './project-workspace.html',
  styleUrl: './project-workspace.css',
  host: { class: 'flex flex-col h-screen w-screen overflow-hidden hero-glow' },
})
export class ProjectWorkspace {
 private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly toasts = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly themeSvc = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly languages = LANGUAGES;
  private readonly aiFeatures = inject(AiFeaturesService);
  private readonly modelsSvc = inject(ModelsService);
  private readonly exportImport = inject(ProjectExportImportService);
  private readonly shortcutsSvc = inject(KeyboardShortcutsService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  protected readonly webSearchAvailable = computed<boolean>(
    () => this.aiFeatures.data()?.web_search_enabled ?? false,
  );

  protected readonly availableModels = computed(
    () => this.modelsSvc.data()?.items ?? [],
  );
  protected readonly defaultChatModel = computed(
    () => this.modelsSvc.data()?.default_model ?? this.prefs.chatModel(),
  );
  protected readonly modelsLoading = computed(() => this.modelsSvc.loading());

  private readonly contextPathsSet = signal<ReadonlySet<string>>(new Set());

  protected readonly contextPaths = computed<string[]>(() => {
    const sel = this.contextPathsSet();
    const known = new Set(this.files().map((e) => e.path));
    return [...sel].filter((p) => known.has(p)).sort();
  });

  protected readonly treeWidth = signal<number>(this.prefs.treePaneWidth());
  protected readonly chatWidth = signal<number>(this.prefs.chatPaneWidth());
  private treeAnchor = this.treeWidth();
  private chatAnchor = this.chatWidth();

  protected readonly gridTemplate = computed<string>(
    () => `${this.treeWidth()}px 6px minmax(0,1fr) 6px ${this.chatWidth()}px`,
  );

  protected readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly project = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.store.selectSignal(selectProjectById(id))();
  });

  protected readonly pending = computed(() => {
    const id = this.id();
    if (!id) return false;
    return this.store.selectSignal(selectIsProjectPending(id))();
  });

  protected readonly notFound = computed(() => {
    const id = this.id();
    if (!id) return false;
    return this.store.selectSignal(selectIsProjectNotFound(id))();
  });

  //  Files state 
  protected readonly files = this.store.selectSignal(selectAllFiles);
  protected readonly filesLoading = this.store.selectSignal(selectFilesLoading);
  protected readonly filesEmpty = this.store.selectSignal(selectFilesIsEmpty);
  protected readonly saving = this.store.selectSignal(selectFilesSaving);
  protected readonly pendingDeletes = this.store.selectSignal(selectFilesDeletingPaths);
  protected readonly pendingRenames = this.store.selectSignal(selectFilesRenamingPaths);

  protected readonly tabs = signal<EditorTab[]>([]);
  protected readonly activeTabPath = signal<string | null>(null);

  @ViewChild('tabStrip') private tabStripRef?: ElementRef<HTMLElement>;

  protected readonly activeTab = computed<EditorTab | null>(() => {
    const path = this.activeTabPath();
    if (!path) return null;
    return this.tabs().find((t) => t.path === path) ?? null;
  });

  protected readonly activeFile = computed(() => this.activeTab()?.file ?? null);
  protected readonly activeFilePath = computed(() => this.activeTab()?.path ?? null);
  protected readonly activeLoadingFile = computed(
    () => this.activeTab()?.loading ?? false,
  );
  protected readonly activeBuffer = computed(() => this.activeTab()?.buffer ?? null);

  protected isTabDirty(t: EditorTab): boolean {
    return t.buffer !== null && t.file !== null && t.buffer !== t.file.content;
  }


  //  Chat sessions 
  protected readonly sessions = this.store.selectSignal(selectAllSessions);
  protected readonly sessionsLoading = this.store.selectSignal(selectLoadingSessions);
  protected readonly activeSessionId = this.store.selectSignal(selectActiveSessionId);
  protected readonly activeSession = this.store.selectSignal(selectActiveSession);
  protected readonly sessionPendingIds = this.store.selectSignal(selectChatPendingIds);
  protected readonly messages = this.store.selectSignal(selectAllMessages);
  protected readonly loadingMessages = this.store.selectSignal(selectChatLoadingMessages);
  protected readonly streaming = this.store.selectSignal(selectChatStreaming);

  protected readonly filePaths = computed(() => this.files().map((f) => f.path));

 
  protected readonly editorLanguage = computed(() => {
    const path = this.activeFilePath();
    if (!path) return 'plaintext';
    return languageFromPath(path);
  });

  protected readonly renameSessionOpen = signal<boolean>(false);
  protected readonly renameSessionTarget = signal<ChatSessionRef | null>(null);

  protected readonly applyOpen = signal<boolean>(false);
  protected readonly applyProposal = signal<ApplyDiffProposal | null>(null);

  protected readonly aiEditOpen = signal<boolean>(false);
  protected readonly searchOpen = signal<boolean>(false);
  protected readonly exporting = signal<boolean>(false);
 
  protected readonly activityView = signal<ActivityView>('files');
  protected readonly terminalOpen = signal<boolean>(false);


  constructor() {
    this.aiFeatures.loadOnce();
    this.modelsSvc.loadOnce();

    this.shortcutsSvc.register({
      id: 'workspace.quick-open',
      keys: 'mod+p',
      description: 'Quick open file',
      group: 'Workspace',
      allowInInput: true,
      handler: () => this.searchOpen.update((v) => !v),
    });

    effect(() => {
      const id = this.id();
      if (!id) return;
      this.store.dispatch(ProjectsActions.loadProject({ id }));
      this.store.dispatch(FilesActions.loadTree({ projectId: id }));
      this.store.dispatch(ChatActions.loadSessions({ projectId: id }));

      untracked(() => {
        this.tabs.set([]);
        this.activeTabPath.set(null);
        this.contextPathsSet.set(new Set());
      });
    });

    effect(() => {
      const active = this.activeTabPath();
      if (!active) return;
      queueMicrotask(() => {
        const strip = this.tabStripRef?.nativeElement;
        if (!strip) return;
        const node = strip.querySelector<HTMLElement>(
          `[data-tab-path="${cssEscape(active)}"]`,
        );
        node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });

    this.actions$
      .pipe(ofType(FilesActions.readFileSuccess), takeUntilDestroyed())
      .subscribe(({ file }) => {
        this.tabs.update((tabs) => {
          const idx = tabs.findIndex((t) => t.path === file.path);
          if (idx < 0) {
            this.activeTabPath.set(file.path);
            return [
              ...tabs,
              { path: file.path, file, loading: false, buffer: null },
            ];
          }
          const next = [...tabs];
          next[idx] = { ...next[idx], file, loading: false };
          return next;
        });
      });

    this.actions$
      .pipe(ofType(FilesActions.readFileFailure), takeUntilDestroyed())
      .subscribe(() => {
        this.tabs.update((tabs) =>
          tabs.map((t) => (t.loading ? { ...t, loading: false } : t)),
        );
      });

    this.actions$
      .pipe(ofType(FilesActions.upsertFileSuccess), takeUntilDestroyed())
      .subscribe(({ file }) => {
        this.toasts.success('File saved', { detail: file.path });
        this.tabs.update((tabs) =>
          tabs.map((t) =>
            t.path === file.path ? { ...t, buffer: null } : t,
          ),
        );
        this.store.dispatch(
          FilesActions.readFile({ projectId: this.id(), path: file.path }),
        );
      });
    this.actions$
      .pipe(ofType(FilesActions.renameFileSuccess), takeUntilDestroyed())
      .subscribe(({ oldPath, newFile }) => {
        this.toasts.success('File renamed', { detail: `→ ${newFile.path}` });
        this.tabs.update((tabs) =>
          tabs.map((t) =>
            t.path === oldPath
              ? { ...t, path: newFile.path, file: newFile, buffer: null }
              : t,
          ),
        );
        // Keep the active tab focused on the new path.
        if (this.activeTabPath() === oldPath) {
          this.activeTabPath.set(newFile.path);
        }
      });

    this.actions$
      .pipe(ofType(FilesActions.renameFileFailure), takeUntilDestroyed())
      .subscribe(({ error }) => {
        this.toasts.error('Rename failed', { detail: error });
      });

    this.actions$
      .pipe(ofType(FilesActions.deleteFileSuccess), takeUntilDestroyed())
      .subscribe(({ path }) => {
        this.toasts.success('File deleted', { detail: path });
        // Force-close: the file is already gone server-side, so the
        // "discard unsaved edits?" prompt would be misleading.
        this.forceCloseTab(path);
      });

    this.actions$
      .pipe(
        ofType(
          FilesActions.upsertFileFailure,
          FilesActions.deleteFileFailure,
          FilesActions.readFileFailure,
          FilesActions.loadTreeFailure,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ error }) => {
        this.toasts.error('Files', { detail: error });
      });


    //  Chat side effects 
    this.actions$
      .pipe(ofType(ChatActions.renameSessionSuccess), takeUntilDestroyed())
      .subscribe(({ session }) => {
        this.renameSessionOpen.set(false);
        this.renameSessionTarget.set(null);
        this.toasts.success('Chat renamed', { detail: session.title });
      });

    this.actions$
      .pipe(ofType(ChatActions.deleteSessionSuccess), takeUntilDestroyed())
      .subscribe(() => {
        this.toasts.success('Chat deleted');
      });

    this.actions$
      .pipe(ofType(ChatActions.exportSessionSuccess), takeUntilDestroyed())
      .subscribe(({ filename }) => {
        this.toasts.success('Chat exported', { detail: filename });
      });

    this.actions$
      .pipe(
        ofType(
          ChatActions.loadSessionsFailure,
          ChatActions.renameSessionFailure,
          ChatActions.deleteSessionFailure,
          ChatActions.exportSessionFailure,
          ChatActions.loadMessagesFailure,
          ChatActions.streamError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ error }) => {
        this.toasts.error('Chat', { detail: error });
      });

    
    this.actions$
      .pipe(ofType(ChatActions.streamSession), takeUntilDestroyed())
      .subscribe(() => {
        const projectId = this.id();
        if (projectId) {
          this.store.dispatch(ChatActions.loadSessions({ projectId }));
        }
      });
  }

  //  Tree handlers 
  protected onSelectFile(path: string): void {
    const id = this.id();
    if (!id) return;
    const existing = this.tabs().find((t) => t.path === path);
    if (existing) {
      // Tab already open — pure activation, no server round-trip.
      this.activeTabPath.set(path);
      return;
    }
    // First time we see this path: append a tab and fire the read.
    // The actions listener writes the body into the tab on success.
    this.tabs.update((tabs) => [
      ...tabs,
      { path, file: null, loading: true, buffer: null },
    ]);
    this.activeTabPath.set(path);
    this.store.dispatch(FilesActions.readFile({ projectId: id, path }));
  }

  //  Tab strip handlers 
  protected onActivateTab(path: string): void {
    if (this.activeTabPath() !== path) this.activeTabPath.set(path);
  }

  protected async onCloseTab(path: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    await this.closeTabByPath(path);
  }

  protected onBufferChange(value: string): void {
    const path = this.activeTabPath();
    if (!path) return;
    this.tabs.update((tabs) =>
      tabs.map((t) => (t.path === path ? { ...t, buffer: value } : t)),
    );
  }

  private async closeTabByPath(path: string): Promise<void> {
    const tabs = this.tabs();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx < 0) return;
    const target = tabs[idx];
    if (this.isTabDirty(target)) {
      const ok = await this.confirmDialog.ask({
        title: 'Discard unsaved changes?',
        body: `"${path}" has unsaved edits that will be lost.`,
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    this.forceCloseTab(path);
  }

  /** Close a tab without checking dirty state — used for delete and project-switch wipes. */
  private forceCloseTab(path: string): void {
    const tabs = this.tabs();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx < 0) return;
    const next = tabs.filter((t) => t.path !== path);
    this.tabs.set(next);
    if (this.activeTabPath() === path) {
      const neighbour = next[idx] ?? next[idx - 1] ?? null;
      this.activeTabPath.set(neighbour?.path ?? null);
    }
  }

  protected basename(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash < 0 ? path : path.slice(slash + 1);
  }

  /** Tab-strip glyph — colour-coded badge per extension. */
  protected iconForFile(path: string): IconName {
    return iconForPath(path);
  }

  //  Editor handlers 
  protected onSaveFile(content: string): void {
    const id = this.id();
    const f = this.activeFile();
    if (!id || !f) return;
    this.store.dispatch(
      FilesActions.upsertFile({ projectId: id, path: f.path, content }),
    );
  }

  protected async onDeleteFromTree(path: string): Promise<void> {
    const id = this.id();
    if (!id) return;
    const ok = await this.confirmDialog.ask({
      title: 'Delete this file?',
      body: `"${path}" will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.store.dispatch(FilesActions.deleteFile({ projectId: id, path }));
  }

  protected async onDeleteFolder(folderPrefix: string): Promise<void> {
    const id = this.id();
    if (!id) return;
    const affected = this.files().filter(
      (e) =>
        e.path === folderPrefix ||
        e.path.startsWith(`${folderPrefix}/`),
    );
    if (affected.length === 0) return;

    const ok = await this.confirmDialog.ask({
      title: 'Delete this folder?',
      body: `All ${affected.length} file(s) inside "${folderPrefix}" will be removed. This cannot be undone.`,
      confirmLabel: 'Delete all',
      danger: true,
    });
    if (!ok) return;

    for (const entry of affected) {
      this.store.dispatch(FilesActions.deleteFile({ projectId: id, path: entry.path }));
    }
  }

  protected onCreateFile(path: string): void {
    const id = this.id();
    if (!id) return;
    this.store.dispatch(FilesActions.upsertFile({ projectId: id, path, content: '' }));
    // Pre-open a loading tab so the editor shows a spinner while the
    // upsert + readFile round-trip completes.
    if (!this.tabs().find((t) => t.path === path)) {
      this.tabs.update((tabs) => [
        ...tabs,
        { path, file: null, loading: true, buffer: null },
      ]);
      this.activeTabPath.set(path);
    }
  }

  protected onCreateFolder(folderPath: string): void {
    const id = this.id();
    if (!id) return;
    const gitkeepPath = `${folderPath}/.gitkeep`;
    this.store.dispatch(
      FilesActions.upsertFile({ projectId: id, path: gitkeepPath, content: '' }),
    );
  }

  //  Multi-file chat context handlers

  protected onContextToggle(path: string): void {
    this.contextPathsSet.update((cur) => {
      const next = new Set(cur);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  protected onContextClear(): void {
    this.contextPathsSet.set(new Set());
  }

  protected async onContextSelectAll(): Promise<void> {
    const all = this.files()
      .filter((e) => !e.path.endsWith('.gitkeep') && e.path !== '.gitkeep')
      .map((e) => e.path);
    if (all.length === 0) {
      this.toasts.info('No files to add', { detail: 'The project is empty.' });
      return;
    }
    const SOFT_LIMIT = 50;
    if (all.length > SOFT_LIMIT) {
      const ok = await this.confirmDialog.ask({
        title: `Add all ${all.length} files?`,
        body: `That's a lot of context — long projects may exceed the model's context window and slow down responses.`,
        confirmLabel: 'Add all',
      });
      if (!ok) return;
    }
    this.contextPathsSet.set(new Set(all));
    this.toasts.success(`${all.length} files added to chat context`);
  }

  protected onRename(ev: RenameEvent): void {
    const id = this.id();
    if (!id) return;

    if (!ev.isDir) {
      this.store.dispatch(
        FilesActions.renameFile({
          projectId: id,
          oldPath: ev.oldPath,
          newPath: ev.newPath,
        }),
      );
      return;
    }

    // Folder rename: batch-rename every file under the old prefix.
    const prefix = `${ev.oldPath}/`;
    const affected = this.files().filter((e) => e.path.startsWith(prefix));
    for (const entry of affected) {
      const newFilePath = `${ev.newPath}/${entry.path.slice(prefix.length)}`;
      this.store.dispatch(
        FilesActions.renameFile({
          projectId: id,
          oldPath: entry.path,
          newPath: newFilePath,
        }),
      );
    }
  }

  // Chat handlers
  protected onSelectSession(id: string): void {
    if (id !== this.activeSessionId()) {
      this.store.dispatch(ChatActions.selectSession({ id }));
    }
  }

  protected onNewChat(): void {
    this.store.dispatch(ChatActions.newSession());
  }

  protected onRenameSession(session: ChatSessionRef): void {
    this.renameSessionTarget.set(session);
    this.renameSessionOpen.set(true);
  }

  protected onExportSession(session: ChatSessionRef): void {
    this.store.dispatch(ChatActions.exportSession({ id: session.id }));
  }

  protected async onDeleteSession(session: ChatSessionRef): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: 'Delete this chat session?',
      body: `"${session.title || 'Untitled'}" and its messages will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.store.dispatch(ChatActions.deleteSession({ id: session.id }));
  }

  protected onSendMessage(payload: ChatSendPayload): void {
    const id = this.id();
    if (!id || this.streaming()) return;
    // Use the model the user selected in the composer. Fall back to
    // the user's global preference if the model list hasn't loaded yet.
    const model = payload.model || this.prefs.chatModel();
    this.store.dispatch(
      ChatActions.sendUserQuery({
        projectId: id,
        payload: {
          model,
          user_query: payload.text,
          session_id: this.activeSessionId() ?? null,
          file_paths: payload.filePaths,
          use_web_search: payload.useWebSearch,
        },
      }),
    );
  }

  // Pane resize handlers
  protected onTreeResizeStart(): void {
    this.treeAnchor = this.prefs.treePaneWidth();
  }

  protected onTreeResize(delta: number): void {
    const next = clampPx(this.treeAnchor + delta, TREE_PANE_MIN, TREE_PANE_MAX);
    this.treeWidth.set(next);
  }

  protected onTreeResizeCommit(): void {
    this.prefs.setTreePaneWidth(this.treeWidth());
  }

  protected onTreeResizeNudge(delta: number): void {
    const next = clampPx(this.treeWidth() + delta, TREE_PANE_MIN, TREE_PANE_MAX);
    this.treeWidth.set(next);
    this.prefs.setTreePaneWidth(next);
  }

  protected onChatResizeStart(): void {
    this.chatAnchor = this.prefs.chatPaneWidth();
  }

  protected onChatResize(delta: number): void {
    const next = clampPx(this.chatAnchor - delta, CHAT_PANE_MIN, CHAT_PANE_MAX);
    this.chatWidth.set(next);
  }

  protected onChatResizeCommit(): void {
    this.prefs.setChatPaneWidth(this.chatWidth());
  }

  protected onChatResizeNudge(delta: number): void {
    // Chat pane sits on the right edge — invert just like the drag.
    const next = clampPx(this.chatWidth() - delta, CHAT_PANE_MIN, CHAT_PANE_MAX);
    this.chatWidth.set(next);
    this.prefs.setChatPaneWidth(next);
  }

  protected onAbortStream(): void {
    this.store.dispatch(ChatActions.abortStream());
  }

  protected onApplyCodeBlock(ev: ApplyCodeBlockEvent): void {
    const projectId = this.id();
    if (!projectId) return;
    this.applyProposal.set({
      projectId,
      path: ev.path,
      proposed: ev.content,
      language: ev.language,
    });
    this.applyOpen.set(true);
  }

  protected onActivitySelect(view: ActivityView): void {
    this.activityView.set(view);
  }

  protected onTerminalFilesChanged(): void {
    const id = this.id();
    if (!id) return;
    this.store.dispatch(FilesActions.loadTree({ projectId: id }));
  }

  protected onOpenSettings(): void {
    void this.router.navigate(['/workspace/settings']);
  }

  protected onAiEdit(): void {
    const f = this.activeFile();
    if (!f) {
      this.toasts.info('Open a file first', {
        detail: 'Select a file in the tree, then try again.',
      });
      return;
    }
    this.aiEditOpen.set(true);
  }

  protected onAiEditApplied(ev: { path: string; content: string }): void {
    const id = this.id();
    if (!id) return;
    this.store.dispatch(
      FilesActions.upsertFile({
        projectId: id,
        path: ev.path,
        content: ev.content,
      }),
    );
  }

  //  Top-bar handlers 
  protected readonly userMenuOpen = signal<boolean>(false);

  protected toggleUserMenu(ev: Event): void {
    ev.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
  }

  protected setLanguage(lang: Lang): void {
    this.prefs.setLanguage(lang);
  }

  protected onExportProject(): void {
    const id = this.id();
    if (!id || this.exporting()) return;
    this.exporting.set(true);
    this.exportImport.export(id).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const slug = (this.project()?.name ?? 'project')
          .replace(/[^\w.-]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'project';
        a.download = `${slug}.syntx.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toasts.success('Project exported');
      },
      error: (err) => {
        this.exporting.set(false);
        this.toasts.error('Export failed', {
          detail: err?.error?.detail ?? `HTTP ${err?.status ?? '?'}`,
        });
      },
    });
  }

  protected initials(email: string): string {
    const local = email.split('@')[0] ?? '';
    if (!local) return '?';
    const parts = local.split(/[._-]/).filter(Boolean);
    const head = parts[0]?.[0] ?? local[0] ?? '?';
    const tail = parts[1]?.[0] ?? '';
    return (head + tail).toUpperCase();
  }

  /** Same Title-Case-the-local-part logic as the global shell. */
  protected displayName(email: string): string {
    const local = email.split('@')[0] ?? '';
    if (!local) return email;
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length === 0) return local;
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  /** Click anywhere outside the popover dismisses it. Mirrors the workspace shell. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = ev.target as Node | null;
    if (!target) {
      this.userMenuOpen.set(false);
      return;
    }
    const root = this.hostEl.nativeElement;
    const popoverEl = root.querySelector('[role="dialog"]');
    const triggerEl = root.querySelector('[aria-haspopup="dialog"]');
    if (popoverEl?.contains(target) || triggerEl?.contains(target)) return;
    this.userMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onUserMenuEscape(): void {
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
  }
}

const EXT_LANGUAGE: Record<string, string> = {
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

function languageFromPath(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  return EXT_LANGUAGE[path.slice(dot + 1).toLowerCase()] ?? 'plaintext';
}

interface EditorTab {
  path: string;
  /** Cached body. `null` while the initial `readFile` is in flight. */
  file: FileRead | null;
  loading: boolean;

  buffer: string | null;
}


function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return s.replace(/([\\!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
}

function clampPx(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
