import { createFeature, createReducer, on } from '@ngrx/store';

import { FileRead, FileTreeEntry } from '../../models/file.model';
import { FilesActions } from './files.actions';

export interface FilesState {
  projectId: string | null;
  entries: FileTreeEntry[];
  openFile: FileRead | null;
  loading: boolean;
  loadingFile: boolean;
  saving: boolean;
  deletingPaths: string[];
  renamingPaths: string[];
  error: string | null;
}

export const initialFilesState: FilesState = {
  projectId: null,
  entries: [],
  openFile: null,
  loading: false,
  loadingFile: false,
  saving: false,
  deletingPaths: [],
  renamingPaths: [],
  error: null,
};

export const filesFeature = createFeature({
  name: 'files',
  reducer: createReducer(
    initialFilesState,

    // Tree
    on(FilesActions.loadTree, (s, { projectId }) => {
      const switching = s.projectId !== projectId;
      return {
        ...s,
        projectId,
        entries: switching ? [] : s.entries,
        openFile: switching ? null : s.openFile,
        loading: true,
        error: null,
      };
    }),
    on(FilesActions.loadTreeSuccess, (s, { tree }) => ({
      ...s,
      projectId: tree.project_id,
      entries: tree.items,
      loading: false,
      error: null,
    })),
    on(FilesActions.loadTreeFailure, (s, { error }) => ({
      ...s,
      loading: false,
      error,
    })),

    // Read single file
    on(FilesActions.readFile, (s) => ({
      ...s,
      loadingFile: true,
      error: null,
    })),
    on(FilesActions.readFileSuccess, (s, { file }) => ({
      ...s,
      openFile: file,
      loadingFile: false,
      error: null,
    })),
    on(FilesActions.readFileFailure, (s, { error }) => ({
      ...s,
      loadingFile: false,
      error,
    })),

    // Upsert (save / create)
    on(FilesActions.upsertFile, (s) => ({
      ...s,
      saving: true,
      error: null,
    })),
    on(FilesActions.upsertFileSuccess, (s, { file }) => {
      const exists = s.entries.some((e) => e.path === file.path);
      const entry: FileTreeEntry = {
        path: file.path,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
        updated_at: file.updated_at,
      };
      const entries = exists
        ? s.entries.map((e) => (e.path === file.path ? entry : e))
        : [...s.entries, entry];
      return {
        ...s,
        entries,
        openFile: s.openFile?.path === file.path ? file : s.openFile,
        saving: false,
        error: null,
      };
    }),
    on(FilesActions.upsertFileFailure, (s, { error }) => ({
      ...s,
      saving: false,
      error,
    })),

    // Delete
    on(FilesActions.deleteFile, (s, { path }) => ({
      ...s,
      deletingPaths: s.deletingPaths.includes(path) ? s.deletingPaths : [...s.deletingPaths, path],
      error: null,
    })),
    on(FilesActions.deleteFileSuccess, (s, { path }) => ({
      ...s,
      entries: s.entries.filter((e) => e.path !== path),
      openFile: s.openFile?.path === path ? null : s.openFile,
      deletingPaths: s.deletingPaths.filter((p) => p !== path),
      error: null,
    })),
    on(FilesActions.deleteFileFailure, (s, { path, error }) => ({
      ...s,
      deletingPaths: s.deletingPaths.filter((p) => p !== path),
      error,
    })),

    // Rename
    on(FilesActions.renameFile, (s, { oldPath }) => ({
      ...s,
      renamingPaths: s.renamingPaths.includes(oldPath)
        ? s.renamingPaths
        : [...s.renamingPaths, oldPath],
      error: null,
    })),
    on(FilesActions.renameFileSuccess, (s, { oldPath, newFile }) => {
      const newEntry: FileTreeEntry = {
        path: newFile.path,
        size_bytes: newFile.size_bytes,
        created_at: newFile.created_at,
        updated_at: newFile.updated_at,
      };
      const entries = s.entries.filter((e) => e.path !== oldPath).concat(newEntry);
      return {
        ...s,
        entries,
        openFile: s.openFile?.path === oldPath ? newFile : s.openFile,
        renamingPaths: s.renamingPaths.filter((p) => p !== oldPath),
        error: null,
      };
    }),
    on(FilesActions.renameFileFailure, (s, { oldPath, error }) => ({
      ...s,
      renamingPaths: s.renamingPaths.filter((p) => p !== oldPath),
      error,
    })),

    on(FilesActions.closeFile, (s) => ({ ...s, openFile: null })),

    on(FilesActions.clearFiles, () => initialFilesState),
  ),
});
