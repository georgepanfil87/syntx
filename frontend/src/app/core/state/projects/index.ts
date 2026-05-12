/**
 * Public surface of the projects slice. Components import from here
 * (`@core/state/projects` once tsconfig paths are wired) so internal
 * file moves don't ripple.
 */
export { ProjectsActions } from './projects.actions';
export { projectsFeature, type ProjectsState } from './projects.reducer';
export {
  selectAllProjects,
  selectIsProjectNotFound,
  selectIsProjectPending,
  selectProjectById,
  selectProjectsCount,
  selectProjectsCreating,
  selectProjectsError,
  selectProjectsIsEmpty,
  selectProjectsLoading,
  selectProjectsNotFoundIds,
  selectProjectsPendingIds,
  selectProjectsState,
  selectProjectsTotal,
} from './projects.selectors';
export { ProjectsEffects } from './projects.effects';
