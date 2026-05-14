import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  map,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { Action } from '@ngrx/store';

import { ChatStreamEvent } from '../../models/chat.model';
import { ChatActions } from './chat.actions';
import { ChatApi } from '../../services/chat/chat-api.service';

let draftCounter = 0;
function nextDraftId(): string {
  return `tmp:${++draftCounter}`;
}

@Injectable()
export class ChatEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ChatApi);

  loadSessions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadSessions),
      switchMap(({ projectId }) =>
        this.api.listSessions(projectId).pipe(
          map((list) => ChatActions.loadSessionsSuccess({ projectId, list })),
          catchError((err) =>
            of(
              ChatActions.loadSessionsFailure({
                projectId,
                error: errorMessage(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  renameSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.renameSession),
      concatMap(({ id, title }) =>
        this.api.renameSession(id, title).pipe(
          map((session) => ChatActions.renameSessionSuccess({ session })),
          catchError((err) =>
            of(ChatActions.renameSessionFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  deleteSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.deleteSession),
      concatMap(({ id }) =>
        this.api.deleteSession(id).pipe(
          map(() => ChatActions.deleteSessionSuccess({ id })),
          catchError((err) =>
            of(ChatActions.deleteSessionFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  exportSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.exportSession),
      concatMap(({ id }) =>
        this.api.exportSession(id).pipe(
          tap(({ blob, filename }) => triggerDownload(blob, filename)),
          map(({ filename }) => ChatActions.exportSessionSuccess({ id, filename })),
          catchError((err) =>
            of(ChatActions.exportSessionFailure({ id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  );

  // Replay
  loadMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadMessages),
      switchMap(({ sessionId }) =>
        this.api.listMessages(sessionId).pipe(
          map((list) => ChatActions.loadMessagesSuccess({ sessionId, list })),
          catchError((err) =>
            of(
              ChatActions.loadMessagesFailure({
                sessionId,
                error: errorMessage(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );


  refreshOnSelect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.selectSession),
      mergeMap(({ id }) =>
        id ? of(ChatActions.loadMessages({ sessionId: id })) : EMPTY,
      ),
    ),
  );

  // Streaming

  sendUserQuery$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendUserQuery),
      switchMap(({ projectId, payload }) => {
        const userId = nextDraftId();
        const draftId = nextDraftId();

        const setup$ = of(
          ChatActions.appendUserMessage({
            id: userId,
            sessionId: payload.session_id ?? null,
            content: payload.user_query,
            filePaths: payload.file_paths,
          }),
          ChatActions.beginAssistantStream({ draftId, model: payload.model }),
        );

        const stream$: Observable<ChatStreamEvent> = this.api.streamProjectChat(
          projectId,
          payload,
        );

        const stream$$ = stream$.pipe(
          takeUntil(this.actions$.pipe(ofType(ChatActions.abortStream))),
          map((event) => mapStreamEvent(event)),
          catchError((err) =>
            of(ChatActions.streamError({ error: errorMessage(err) })),
          ),
        );

        return new Observable<Action>((subscriber) => {
          const setupSub = setup$.subscribe((a) => subscriber.next(a));
          const streamSub = stream$$.subscribe({
            next: (a) => subscriber.next(a),
            error: (e) => subscriber.error(e),
            complete: () => {
              subscriber.next(ChatActions.streamDone());
              subscriber.complete();
            },
          });
          return () => {
            setupSub.unsubscribe();
            streamSub.unsubscribe();
          };
        });
      }),
    ),
  );

}

function mapStreamEvent(event: ChatStreamEvent) {
  switch (event.kind) {
    case 'session':
      return ChatActions.streamSession({ sessionId: event.sessionId });
    case 'token':
      return ChatActions.streamToken({ token: event.token });
    case 'done':
      return ChatActions.streamDone();
    case 'error':
      return ChatActions.streamError({ error: event.error });
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || !blob.size) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as { detail?: string } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (err.status === 0) return 'Cannot reach the server.';
    return `Request failed (HTTP ${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}
