import { createSelector } from '@ngrx/store';

import { filesFeature } from './files.reducer';

export const {
  selectFilesState,
  selectProjectId: selectFilesProjectId,
  selectEntries: selectAllFiles,
  selectOpenFile,
  selectLoading: selectFilesLoading,
  selectLoadingFile: selectFilesLoadingFile,
  selectSaving: selectFilesSaving,
  selectDeletingPaths: selectFilesDeletingPaths,
  selectRenamingPaths: selectFilesRenamingPaths,
  selectError: selectFilesError,
} = filesFeature;

export const selectFilesIsEmpty = createSelector(
  selectAllFiles,
  selectFilesLoading,
  (entries, loading) => !loading && entries.length === 0,
);

export const selectIsFileDeleting = (path: string) =>
  createSelector(selectFilesDeletingPaths, (paths) => paths.includes(path));
