import { createActionGroup, emptyProps, props } from '@ngrx/store';

import {
  Project,
  ProjectCreate,
  ProjectPage,
  ProjectUpdate,
} from '../../models/project.model';

export const ProjectsActions = createActionGroup({
  source: 'Projects',
  events: {
    'Load Projects': props<{ limit?: number; offset?: number }>(),
    'Load Projects Success': props<{ page: ProjectPage }>(),
    'Load Projects Failure': props<{ error: string }>(),

    'Load Project': props<{ id: string }>(),
    'Load Project Success': props<{ project: Project }>(),
    'Load Project Failure': props<{ id: string; error: string }>(),

    'Create Project': props<{ payload: ProjectCreate }>(),
    'Create Project Success': props<{ project: Project }>(),
    'Create Project Failure': props<{ error: string }>(),

    'Update Project': props<{ id: string; changes: ProjectUpdate }>(),
    'Update Project Success': props<{ project: Project }>(),
    'Update Project Failure': props<{ id: string; error: string }>(),

    'Delete Project': props<{ id: string }>(),
    'Delete Project Success': props<{ id: string }>(),
    'Delete Project Failure': props<{ id: string; error: string }>(),

    'Clear Projects': emptyProps(),
  },
});
