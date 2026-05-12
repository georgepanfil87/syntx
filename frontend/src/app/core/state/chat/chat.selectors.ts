import { createSelector } from '@ngrx/store';

import { chatFeature } from './chat.reducer';

export const {
  selectChatState,
  selectProjectId: selectChatProjectId,
  selectSessions: selectAllSessions,
  selectActiveSessionId,
  selectLoadingSessions,
  selectPendingIds: selectChatPendingIds,
  selectMessages: selectAllMessages,
  selectLoadingMessages: selectChatLoadingMessages,
  selectStreaming: selectChatStreaming,
  selectError: selectChatError,
} = chatFeature;

export const selectActiveSession = createSelector(
  selectAllSessions,
  selectActiveSessionId,
  (sessions, id) => sessions.find((s) => s.id === id) ?? null,
);

export const selectChatIsEmpty = createSelector(
  selectAllSessions,
  selectLoadingSessions,
  (items, loading) => !loading && items.length === 0,
);

export const selectIsSessionPending = (id: string) =>
  createSelector(selectChatPendingIds, (pending) => pending.includes(id));
