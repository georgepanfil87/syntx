import { createActionGroup, emptyProps, props } from '@ngrx/store';

import {
  ChatMessageList,
  ChatSessionList,
  ChatSessionRef,
  ProjectChatRequest,
} from '../../models/chat.model';

export const ChatActions = createActionGroup({
  source: 'Chat',
  events: {
    'Load Sessions': props<{ projectId: string }>(),
    'Load Sessions Success': props<{ projectId: string; list: ChatSessionList }>(),
    'Load Sessions Failure': props<{ projectId: string; error: string }>(),

    'Select Session': props<{ id: string | null }>(),
    'New Session': emptyProps(),

    'Rename Session': props<{ id: string; title: string }>(),
    'Rename Session Success': props<{ session: ChatSessionRef }>(),
    'Rename Session Failure': props<{ id: string; error: string }>(),

    'Delete Session': props<{ id: string }>(),
    'Delete Session Success': props<{ id: string }>(),
    'Delete Session Failure': props<{ id: string; error: string }>(),

    'Export Session': props<{ id: string }>(),
    'Export Session Success': props<{ id: string; filename: string }>(),
    'Export Session Failure': props<{ id: string; error: string }>(),

    // Messages replay
    'Load Messages': props<{ sessionId: string }>(),
    'Load Messages Success': props<{ sessionId: string; list: ChatMessageList }>(),
    'Load Messages Failure': props<{ sessionId: string; error: string }>(),
    'Clear Messages': emptyProps(),

    // Streaming
    'Send User Query': props<{ projectId: string; payload: ProjectChatRequest }>(),
    'Append User Message': props<{
      id: string;
      sessionId: string | null;
      content: string;
      filePaths?: string[];
    }>(),
    'Begin Assistant Stream': props<{ draftId: string; model: string }>(),
    'Stream Session': props<{ sessionId: string }>(),
    'Stream Token': props<{ token: string }>(),
    'Stream Done': emptyProps(),
    'Stream Error': props<{ error: string }>(),
    'Abort Stream': emptyProps(),

    'Clear Chat': emptyProps(),
  },
});
