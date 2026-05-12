import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ENVIRONMENT } from '../../config/environment';
import {
  ChatSessionList,
  ChatMessageList,
  ProjectChatRequest,
  ChatStreamEvent,
  ChatSessionRef,
  ChatSessionUpdate,
} from '../../models/chat.model';
import { ApiService } from '../api/api.service';
import { TokenStorageService } from '../token-storage/token-storage.service';

export interface ExportedSession {
  blob: Blob;
  filename: string;
}

@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);

  listSessions(projectId: string): Observable<ChatSessionList> {
    return this.api.get<ChatSessionList>(`/projects/${projectId}/chat/sessions`);
  }

  listMessages(sessionId: string): Observable<ChatMessageList> {
    return this.api.get<ChatMessageList>(`/chat/sessions/${sessionId}/messages`);
  }

  /**
   * Stream a project-aware chat reply.
   *
   * `EventSource` won't do — we need:
   *   1. POST + JSON body (EventSource is GET-only).
   *   2. The bearer token in `Authorization` (EventSource lacks
   *      header support before the polyfill dance).
   *
   * So this hand-rolls SSE on top of `fetch` + `ReadableStream`. The
   * returned Observable yields one `ChatStreamEvent` per parsed
   * frame and completes on `done`. Cancellation: the inner
   * `AbortController` fires when the subscription tears down, which
   * propagates back to the server via the closed connection.
   *
   * Frame format (matches `backend/app/api/v1/ai.py`):
   *   event: session\n
   *   data: {"session_id": "..."}\n
   *   \n
   *   event: token\n
   *   data: {"token": "..."}\n
   *   \n
   *   event: done\n
   *   data: {}\n
   *   \n
   */
  streamProjectChat(projectId: string, body: ProjectChatRequest): Observable<ChatStreamEvent> {
    const url = `${ENVIRONMENT.apiBaseUrl}/ai/projects/${projectId}/chat`;
    const token = this.tokens.read();
    return new Observable<ChatStreamEvent>((subscriber) => {
      const controller = new AbortController();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      void runStream({
        url,
        body,
        headers,
        signal: controller.signal,
        emit: (ev) => subscriber.next(ev),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });

      // Teardown — fired on takeUntil / unsubscribe / component destroy.
      return () => controller.abort();
    });
  }

  renameSession(sessionId: string, title: string): Observable<ChatSessionRef> {
    return this.api.patch<ChatSessionRef, ChatSessionUpdate>(`/chat/sessions/${sessionId}`, {
      title,
    });
  }

  deleteSession(sessionId: string): Observable<void> {
    return this.api.delete<void>(`/chat/sessions/${sessionId}`);
  }

  /**
   * Fetch the export as a JSON blob plus a filename suggestion. We
   * read the `Content-Disposition` header when present and fall back
   * to a stable client-side default — the server is the source of
   * truth for the filename, but we shouldn't crash if it's missing.
   */
  exportSession(sessionId: string): Observable<ExportedSession> {
    const url = `${ENVIRONMENT.apiBaseUrl}/chat/sessions/${sessionId}/export`;
    return this.http.get(url, { observe: 'response', responseType: 'blob' }).pipe(
      map((res: HttpResponse<Blob>) => ({
        blob: res.body ?? new Blob(),
        filename: filenameFromHeaders(res) ?? `chat-session-${sessionId}.json`,
      })),
    );
  }
}

function filenameFromHeaders(res: HttpResponse<unknown>): string | null {
  const header = res.headers.get('Content-Disposition');
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

interface StreamRunArgs {
  url: string;
  body: ProjectChatRequest;
  headers: Record<string, string>;
  signal: AbortSignal;
  emit: (event: ChatStreamEvent) => void;
  complete: () => void;
  error: (err: unknown) => void;
}

/**
 * Drives the fetch + ReadableStream loop. Errors are forwarded to the
 * subscriber; an aborted request swallows the AbortError so the
 * Observable just completes silently (the caller asked us to stop).
 */
async function runStream(args: StreamRunArgs): Promise<void> {
  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: args.headers,
      body: JSON.stringify(args.body),
      signal: args.signal,
    });

    if (!res.ok) {
      const detail = await readErrorDetail(res);
      args.error(new Error(detail || `HTTP ${res.status}`));
      return;
    }
    if (!res.body) {
      args.error(new Error('Empty response body.'));
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      // Frames are separated by a blank line. The double newline can
      // be `\n\n` or `\r\n\r\n` depending on the server runtime.
      let separator: number;
      while ((separator = nextFrameBoundary(buffer)) >= 0) {
        const frame = buffer.slice(0, separator).trimEnd();
        buffer = buffer.slice(separator).replace(/^(\r?\n){1,2}/, '');
        const event = parseFrame(frame);
        if (event) args.emit(event);
        if (event?.kind === 'done') {
          args.complete();
          return;
        }
      }
    }
    args.complete();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      args.complete();
      return;
    }
    args.error(err);
  }
}

function nextFrameBoundary(buf: string): number {
  const lf = buf.indexOf('\n\n');
  const crlf = buf.indexOf('\r\n\r\n');
  if (lf < 0) return crlf;
  if (crlf < 0) return lf;
  return Math.min(lf, crlf);
}

function parseFrame(frame: string): ChatStreamEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    if (rawLine.startsWith(':')) continue; // SSE comment
    if (rawLine.startsWith('event:')) {
      event = rawLine.slice(6).trim();
    } else if (rawLine.startsWith('data:')) {
      dataLines.push(rawLine.slice(5).trimStart());
    }
  }
  const data = dataLines.join('\n');

  switch (event) {
    case 'session': {
      // Backend (`backend/app/api/v1/ai.py`) emits `{ "id": "..." }`.
      // Older snapshots used `session_id`; we accept both so a
      // mismatched deploy still works without UI breakage.
      const parsed = safeJson<{ id?: string; session_id?: string }>(data);
      const id = parsed?.id ?? parsed?.session_id;
      return id ? { kind: 'session', sessionId: id } : null;
    }
    case 'token': {
      // Backend emits `{ "content": "..." }` per fragment. Accept
      // `token` too as a defensive alias.
      const parsed = safeJson<{ content?: string; token?: string }>(data);
      const token = parsed?.content ?? parsed?.token ?? '';
      return token ? { kind: 'token', token } : null;
    }
    case 'done':
      return { kind: 'done' };
    case 'error': {
      const parsed = safeJson<{ detail?: string; error?: string }>(data);
      return {
        kind: 'error',
        error: parsed?.detail || parsed?.error || data || 'Stream error.',
      };
    }
    default:
      return null;
  }
}

function safeJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j?.detail === 'string') return j.detail;
    } catch {
      /* fall through */
    }
    return text;
  } catch {
    return '';
  }
}
