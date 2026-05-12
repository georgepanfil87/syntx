import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { ProjectsActions } from './projects.actions';
import { ProjectsApi } from '../../services/projects/projects-api.service';


@Injectable()
export class ProjectsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ProjectsApi);

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProjectsActions.loadProjects),
      switchMap(({ limit, offset }) =>
        this.api.list({ limit, offset }).pipe(
          map((page) => ProjectsActions.loadProjectsSuccess({ page })),
          catchError((err) =>
            of(ProjectsActions.loadProjectsFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProjectsActions.loadProject),
      switchMap(({ id }) =>
        this.api.getById(id).pipe(
          map((project) => ProjectsActions.loadProjectSuccess({ project })),
          catchError((err) =>
            of(ProjectsActions.loadProjectFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProjectsActions.createProject),
      concatMap(({ payload }) =>
        this.api.create(payload).pipe(
          map((project) => ProjectsActions.createProjectSuccess({ project })),
          catchError((err) =>
            of(ProjectsActions.createProjectFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProjectsActions.updateProject),
      concatMap(({ id, changes }) =>
        this.api.update(id, changes).pipe(
          map((project) => ProjectsActions.updateProjectSuccess({ project })),
          catchError((err) =>
            of(ProjectsActions.updateProjectFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProjectsActions.deleteProject),
      concatMap(({ id }) =>
        this.api.delete(id).pipe(
          map(() => ProjectsActions.deleteProjectSuccess({ id })),
          catchError((err) =>
            of(ProjectsActions.deleteProjectFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as { detail?: string } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (err.status === 0) return 'Cannot reach the server.';
    return `Request failed (HTTP ${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}
