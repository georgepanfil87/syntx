import { createFeature, createReducer, on } from '@ngrx/store';

import { ChatMessageRef, ChatSessionRef } from '../../models/chat.model';
import { ChatActions } from './chat.actions';

export interface UiChatMessage extends Omit<ChatMessageRef, 'id'> {
  id: string;
  streaming?: boolean;

  filePaths?: string[];
  streamingStartedAt?: number;
  streamingEndedAt?: number;
}

export interface ChatState {
  projectId: string | null;
  sessions: ChatSessionRef[];
  activeSessionId: string | null;
  loadingSessions: boolean;
  pendingIds: string[];
  messages: UiChatMessage[];
  loadingMessages: boolean;
  streaming: boolean;
  error: string | null;
}

export const initialChatState: ChatState = {
  projectId: null,
  sessions: [],
  activeSessionId: null,
  loadingSessions: false,
  pendingIds: [],
  messages: [],
  loadingMessages: false,
  streaming: false,
  error: null,
};

export const chatFeature = createFeature({
  name: 'chat',
  reducer: createReducer(
    initialChatState,

    on(ChatActions.loadSessions, (s, { projectId }) => {
      const switching = s.projectId !== projectId;
      return {
        ...s,
        projectId,
        sessions: switching ? [] : s.sessions,
        activeSessionId: switching ? null : s.activeSessionId,
        messages: switching ? [] : s.messages,
        loadingSessions: true,
        error: null,
      };
    }),
    on(ChatActions.loadSessionsSuccess, (s, { projectId, list }) => ({
      ...s,
      projectId,
      sessions: list.items,
      loadingSessions: false,
      error: null,
    })),
    on(ChatActions.loadSessionsFailure, (s, { error }) => ({
      ...s,
      loadingSessions: false,
      error,
    })),

    on(ChatActions.selectSession, (s, { id }) => ({
      ...s,
      activeSessionId: id,

      messages: id === s.activeSessionId ? s.messages : [],
    })),
    on(ChatActions.newSession, (s) => ({
      ...s,
      activeSessionId: null,
      messages: [],
    })),

    // Rename
    on(ChatActions.renameSession, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      error: null,
    })),
    on(ChatActions.renameSessionSuccess, (s, { session }) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === session.id ? session : x)),
      pendingIds: s.pendingIds.filter((pid) => pid !== session.id),
      error: null,
    })),
    on(ChatActions.renameSessionFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error,
    })),

    // Delete
    on(ChatActions.deleteSession, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      error: null,
    })),
    on(ChatActions.deleteSessionSuccess, (s, { id }) => ({
      ...s,
      sessions: s.sessions.filter((x) => x.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      messages: s.activeSessionId === id ? [] : s.messages,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error: null,
    })),
    on(ChatActions.deleteSessionFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error,
    })),

    // Export
    on(ChatActions.exportSession, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.includes(id) ? s.pendingIds : [...s.pendingIds, id],
      error: null,
    })),
    on(ChatActions.exportSessionSuccess, (s, { id }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
    })),
    on(ChatActions.exportSessionFailure, (s, { id, error }) => ({
      ...s,
      pendingIds: s.pendingIds.filter((pid) => pid !== id),
      error,
    })),

    // Messages
    on(ChatActions.loadMessages, (s) => ({
      ...s,
      loadingMessages: true,
      error: null,
    })),
    on(ChatActions.loadMessagesSuccess, (s, { sessionId, list }) => {
      if (s.activeSessionId !== sessionId) {
        return { ...s, loadingMessages: false };
      }
      return {
        ...s,
        messages: list.items.map((m) => ({ ...m })),
        loadingMessages: false,
        error: null,
      };
    }),
    on(ChatActions.loadMessagesFailure, (s, { error }) => ({
      ...s,
      loadingMessages: false,
      error,
    })),
    on(ChatActions.clearMessages, (s) => ({ ...s, messages: [] })),

    // Streaming
    on(ChatActions.appendUserMessage, (s, { id, sessionId, content, filePaths }) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id,
          session_id: sessionId ?? '',
          role: 'user',
          content,
          model: null,
          token_count: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          filePaths: filePaths && filePaths.length > 0 ? filePaths : undefined,
        },
      ],
    })),
    on(ChatActions.beginAssistantStream, (s, { draftId, model }) => ({
      ...s,
      streaming: true,
      error: null,
      messages: [
        ...s.messages,
        {
          id: draftId,
          session_id: s.activeSessionId ?? '',
          role: 'assistant',
          content: '',
          model,
          token_count: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          streaming: true,
          streamingStartedAt: Date.now(),
        },
      ],
    })),
    on(ChatActions.streamSession, (s, { sessionId }) => ({
      ...s,
      activeSessionId: sessionId,
      messages: s.messages.map((m) => (m.session_id ? m : { ...m, session_id: sessionId })),
    })),
    on(ChatActions.streamToken, (s, { token }) => ({
      ...s,
      messages: s.messages.map((m, i, arr) =>
        i === arr.length - 1 && m.streaming ? { ...m, content: m.content + token } : m,
      ),
    })),
    on(ChatActions.streamDone, (s) => ({
      ...s,
      streaming: false,
      messages: s.messages.map((m) =>
        m.streaming ? { ...m, streaming: false, streamingEndedAt: Date.now() } : m,
      ),
    })),
    on(ChatActions.streamError, (s, { error }) => ({
      ...s,
      streaming: false,
      messages: s.messages.filter((m) => !m.streaming),
      error,
    })),
    on(ChatActions.abortStream, (s) => ({
      ...s,
      streaming: false,
      messages: s.messages.map((m) =>
        m.streaming
          ? {
              ...m,
              streaming: false,
              streamingEndedAt: Date.now(),
              content: m.content || '(aborted)',
            }
          : m,
      ),
    })),

    on(ChatActions.clearChat, () => initialChatState),
  ),
});
