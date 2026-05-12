import { createSelector } from '@ngrx/store';

import { projectsFeature } from './projects.reducer';

export const {
  selectProjectsState,
  selectItems: selectAllProjects,
  selectTotal: selectProjectsTotal,
  selectLoading: selectProjectsLoading,
  selectCreating: selectProjectsCreating,
  selectPendingIds: selectProjectsPendingIds,
  selectNotFoundIds: selectProjectsNotFoundIds,
  selectError: selectProjectsError,
} = projectsFeature;

export const selectIsProjectPending = (id: string) =>
  createSelector(selectProjectsPendingIds, (pending) => pending.includes(id));

export const selectIsProjectNotFound = (id: string) =>
  createSelector(selectProjectsNotFoundIds, (missing) => missing.includes(id));

export const selectProjectById = (id: string) =>
  createSelector(selectAllProjects, (items) => items.find((p) => p.id === id) ?? null);

export const selectProjectsCount = createSelector(
  selectAllProjects,
  (items) => items.length,
);

export const selectProjectsIsEmpty = createSelector(
  selectAllProjects,
  selectProjectsLoading,
  (items, loading) => !loading && items.length === 0,
);
