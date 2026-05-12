import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Button, Icon } from '../../../../shared/ui';
import { EmptyState } from '../../../../shared/components';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { Project } from '../../../../core/models/project.model';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import {
  selectAllProjects,
  selectProjectsLoading,
  selectProjectsIsEmpty,
  selectProjectsPendingIds,
  ProjectsActions,
} from '../../../../core/state/projects';
import { ProjectExportImportService } from '../../../../core/services/projects/project-export-import.service';
import { ProjectCard } from '../../components/project-card/project-card';
import { ProjectCreateModal } from '../../components/project-create-modal/project-create-modal';
import { ProjectRenameModal } from "../../components/project-rename-modal/project-rename-modal";

@Component({
  selector: 'sx-projects-list',
  imports: [Button, Icon, EmptyState, ProjectCard, ProjectCreateModal, ProjectRenameModal],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsList implements OnInit {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly toasts = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly exportImport = inject(ProjectExportImportService);
  protected readonly i18n = inject(I18nService);

  protected readonly projects = this.store.selectSignal(selectAllProjects);
  protected readonly loading = this.store.selectSignal(selectProjectsLoading);
  protected readonly isEmpty = this.store.selectSignal(selectProjectsIsEmpty);
  private readonly pendingIds = this.store.selectSignal(selectProjectsPendingIds);

  protected readonly createOpen = signal<boolean>(false);
  protected readonly renameOpen = signal<boolean>(false);
  protected readonly renameTarget = signal<Project | null>(null);
  protected readonly importing = signal<boolean>(false);

  protected readonly isPending = (id: string) => computed(() => this.pendingIds().includes(id))();

  constructor() {
    this.actions$
      .pipe(ofType(ProjectsActions.createProjectSuccess), takeUntilDestroyed())
      .subscribe(({ project }) => {
        this.createOpen.set(false);
        this.toasts.success(this.i18n.t('projects.created'), { detail: project.name });
      });

    this.actions$
      .pipe(ofType(ProjectsActions.updateProjectSuccess), takeUntilDestroyed())
      .subscribe(({ project }) => {
        this.renameOpen.set(false);
        this.renameTarget.set(null);
        this.toasts.success(this.i18n.t('projects.renamed'), { detail: project.name });
      });

    this.actions$
      .pipe(ofType(ProjectsActions.deleteProjectSuccess), takeUntilDestroyed())
      .subscribe(() => {
        this.toasts.success(this.i18n.t('projects.deleted'));
      });
    this.actions$
      .pipe(
        ofType(
          ProjectsActions.createProjectFailure,
          ProjectsActions.loadProjectsFailure,
          ProjectsActions.updateProjectFailure,
          ProjectsActions.deleteProjectFailure,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ error }) => {
        this.toasts.error(this.i18n.t('projects.tagline'), { detail: error });
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ProjectsActions.loadProjects({}));
  }

  protected openCreate(): void {
    this.createOpen.set(true);
  }

  protected openRename(project: Project): void {
    this.renameTarget.set(project);
    this.renameOpen.set(true);
  }

  protected async confirmDelete(project: Project): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('projects.deleteConfirmTitle'),
      body: this.i18n.t('projects.deleteConfirmBody', { name: project.name }),
      confirmLabel: this.i18n.t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.store.dispatch(ProjectsActions.deleteProject({ id: project.id }));
  }
  protected onImportPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing.set(true);
    this.exportImport.import(file).subscribe({
      next: (project) => {
        this.importing.set(false);
        this.toasts.success(this.i18n.t('projects.imported'), { detail: project.name });
        this.store.dispatch(ProjectsActions.loadProjects({}));
      },
      error: (err) => {
        this.importing.set(false);
        const detail =
          err?.error?.detail ??
          (err?.status === 0
            ? this.i18n.t('projects.cannotReachServer')
            : `HTTP ${err?.status ?? '?'}`);
        this.toasts.error(this.i18n.t('projects.importFailed'), { detail });
      },
    });
  }
}
