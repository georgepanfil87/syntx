import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';


import { FilesActions } from './files.actions';
import { FilesApi } from '../../services/files/files-api.service';

@Injectable()
export class FilesEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(FilesApi);

  loadTree$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FilesActions.loadTree),
      switchMap(({ projectId }) =>
        this.api.tree(projectId).pipe(
          map((tree) => FilesActions.loadTreeSuccess({ tree })),
          catchError((err) =>
            of(FilesActions.loadTreeFailure({ projectId, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  readFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FilesActions.readFile),
      switchMap(({ projectId, path }) =>
        this.api.read(projectId, path).pipe(
          map((file) => FilesActions.readFileSuccess({ file })),
          catchError((err) =>
            of(
              FilesActions.readFileFailure({
                projectId,
                path,
                error: errorMessage(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  upsertFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FilesActions.upsertFile),
      concatMap(({ projectId, path, content }) =>
        this.api.upsert(projectId, path, { content }).pipe(
          map((file) => FilesActions.upsertFileSuccess({ file })),
          catchError((err) =>
            of(
              FilesActions.upsertFileFailure({
                projectId,
                path,
                error: errorMessage(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  deleteFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FilesActions.deleteFile),
      concatMap(({ projectId, path }) =>
        this.api.delete(projectId, path).pipe(
          map(() => FilesActions.deleteFileSuccess({ projectId, path })),
          catchError((err) =>
            of(
              FilesActions.deleteFileFailure({
                projectId,
                path,
                error: errorMessage(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  renameFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FilesActions.renameFile),
      concatMap(({ projectId, oldPath, newPath }) =>
        this.api.read(projectId, oldPath).pipe(
          switchMap((file) =>
            this.api.upsert(projectId, newPath, { content: file.content }).pipe(
              switchMap((newFile) =>
                this.api.delete(projectId, oldPath).pipe(
                  map(() =>
                    FilesActions.renameFileSuccess({ projectId, oldPath, newFile }),
                  ),
                ),
              ),
            ),
          ),
          catchError((err) =>
            of(
              FilesActions.renameFileFailure({
                projectId,
                oldPath,
                error: errorMessage(err),
              }),
            ),
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
