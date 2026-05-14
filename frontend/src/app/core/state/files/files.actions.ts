import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { FileRead, FileTree } from '../../models/file.model';
export const FilesActions = createActionGroup({
  source: 'Files',
  events: {
    'Load Tree': props<{ projectId: string }>(),
    'Load Tree Success': props<{ tree: FileTree }>(),
    'Load Tree Failure': props<{ projectId: string; error: string }>(),

    'Read File': props<{ projectId: string; path: string }>(),
    'Read File Success': props<{ file: FileRead }>(),
    'Read File Failure': props<{ projectId: string; path: string; error: string }>(),

    'Upsert File': props<{ projectId: string; path: string; content: string }>(),
    'Upsert File Success': props<{ file: FileRead }>(),
    'Upsert File Failure': props<{ projectId: string; path: string; error: string }>(),

    'Delete File': props<{ projectId: string; path: string }>(),
    'Delete File Success': props<{ projectId: string; path: string }>(),
    'Delete File Failure': props<{ projectId: string; path: string; error: string }>(),

    'Rename File': props<{ projectId: string; oldPath: string; newPath: string }>(),
    'Rename File Success': props<{ projectId: string; oldPath: string; newFile: FileRead }>(),
    'Rename File Failure': props<{ projectId: string; oldPath: string; error: string }>(),

    'Close File': emptyProps(),

    'Clear Files': emptyProps(),
  },
});
