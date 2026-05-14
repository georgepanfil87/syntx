export interface ChatSessionRef {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionList {
  items: ChatSessionRef[];
}

export interface ChatSessionUpdate {
  title: string;
}

export interface ChatMessageRef {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  model: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageList {
  items: ChatMessageRef[];
}

export interface ProjectChatRequest {
  model: string;
  user_query: string;
  file_paths?: string[];
  session_id?: string | null;
  use_web_search?: boolean;
}

// Parsed SSE frame from the chat stream. We narrow event names to
// exactly what the backend emits — adding one means updating both
// sides at the same time.
export type ChatStreamEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'token'; token: string }
  | { kind: 'done' }
  | { kind: 'error'; error: string };
