import { createFeature, createReducer, on } from '@ngrx/store';

import { Project } from '../../models/project.model';
import { ProjectsActions } from './projects.actions';

export interface ProjectsState {
  items: Project[];
  total: number;
  loading: boolean;
  creating: boolean;
  pendingIds: string[];

  notFoundIds: string[];
  error: string | null;
}

export const initialProjectsState: ProjectsState = {
  items: [],
  total: 0,
  loading: false,
  creating: false,
  pendingIds: [],
  notFoundIds: [],
  error: null,
};

export const projectsFeature = createFeature({
  name: 'projects',
  reducer: createReducer(
    initialProjectsState,

    on(ProjectsActions.loadProjects, (s) => ({
      ...s,
      loading: true,
      error: null,
    })),
    on(ProjectsActions.loadProjectsSuccess, (s, { page }) => ({
      ...s,
      items: page.items,
      total: page.total,
      loading: false,
      error: null,
    })),
    on(ProjectsActions.loadProjectsFailure, (s, { error }) => ({
      ...s,
      loading: false,
      error,
    })),

    on(ProjectsActions.loadProject, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      notFoundIds: s.notFoundIds.filter((nid) => nid !== id),
      error: null,
    })),
    on(ProjectsActions.loadProjectSuccess, (s, { project }) => {
      const exists = s.items.some((p) => p.id === project.id);
      const items = exists
        ? s.items.map((p) => (p.id === project.id ? project : p))
        : [project, ...s.items];
      const total = exists ? s.total : s.total + 1;
      return {
        ...s,
        items,
        total,
        pendingIds: s.pendingIds.filter((pid) => pid !== project.id),
        notFoundIds: s.notFoundIds.filter((nid) => nid !== project.id),
        error: null,
      };
    }),
    on(ProjectsActions.loadProjectFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      notFoundIds: s.notFoundIds.includes(id) ? s.notFoundIds : [...s.notFoundIds, id],
      error,
    })),

    on(ProjectsActions.createProject, (s) => ({
      ...s,
      creating: true,
      error: null,
    })),
    on(ProjectsActions.createProjectSuccess, (s, { project }) => ({
      ...s,
      items: [project, ...s.items],
      total: s.total + 1,
      creating: false,
      error: null,
    })),
    on(ProjectsActions.createProjectFailure, (s, { error }) => ({
      ...s,
      creating: false,
      error,
    })),

    on(ProjectsActions.updateProject, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      error: null,
    })),
    on(ProjectsActions.updateProjectSuccess, (s, { project }) => ({
      ...s,
      items: s.items.map((p) => (p.id === project.id ? project : p)),
      pendingIds: s.pendingIds.filter((pid) => pid !== project.id),
      error: null,
    })),
    on(ProjectsActions.updateProjectFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error,
    })),

    on(ProjectsActions.deleteProject, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      error: null,
    })),
    on(ProjectsActions.deleteProjectSuccess, (s, { id }) => ({
      ...s,
      items: s.items.filter((p) => p.id !== id),
      total: Math.max(0, s.total - 1),
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error: null,
    })),
    on(ProjectsActions.deleteProjectFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error,
    })),

    on(ProjectsActions.clearProjects, () => initialProjectsState),
  ),
});
