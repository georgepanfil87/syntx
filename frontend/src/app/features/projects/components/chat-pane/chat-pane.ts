import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ModelRef } from '../../../../core/models/ai.model';
import { ChatSessionRef } from '../../../../core/models/chat.model';
import { UiChatMessage } from '../../../../core/state/chat';
import { ChatSendPayload, ChatComposer } from '../chat-composer/chat-composer';
import { Icon } from "../../../../shared/ui";
import { ChatThread } from "../chat-thread/chat-thread";
import { ChatSessionsList } from "../chat-sessions-list/chat-sessions-list";
import { ApplyCodeBlockEvent } from '../message-content/message-content';

@Component({
  selector: 'chat-pane',
  imports: [Icon, ChatComposer, ChatThread, ChatSessionsList],
  templateUrl: './chat-pane.html',
  styleUrl: './chat-pane.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
  class: 'flex flex-col h-full min-h-0',
},
})
export class ChatPane {
  // Inputs
  readonly sessions = input.required<readonly ChatSessionRef[]>();
  readonly activeSession = input<ChatSessionRef | null>(null);
  readonly activeSessionId = input<string | null>(null);
  readonly sessionPendingIds = input<readonly string[]>([]);
  readonly loadingSessions = input<boolean>(false);

  readonly messages = input.required<readonly UiChatMessage[]>();
  readonly loadingMessages = input<boolean>(false);
  readonly streaming = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly availableFiles = input<readonly string[]>([]);
  readonly openFilePath = input<string | null>(null);
  readonly webSearchAvailable = input<boolean>(false);
  readonly availableModels = input<readonly ModelRef[]>([]);
  readonly defaultModel = input<string>('');
  readonly modelsLoading = input<boolean>(false);
  readonly contextFiles = input<readonly string[]>([]);

  // Outputs
  readonly selectSession = output<string>();
  readonly newChat = output<void>();
  readonly rename = output<ChatSessionRef>();
  readonly export = output<ChatSessionRef>();
  readonly delete = output<ChatSessionRef>();

  readonly send = output<ChatSendPayload>();
  readonly abort = output<void>();
  readonly applyCodeBlock = output<ApplyCodeBlockEvent>();
  readonly removeContextFile = output<string>();
  readonly clearContextFiles = output<void>();

  // Local state
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<'list' | 'detail'>('list');

  protected composerPlaceholder(): string {
    return this.activeSessionId()
      ? this.i18n.t('chat.placeholderContinue')
      : this.i18n.t('chat.placeholderNew');
  }

  constructor() {

    effect(() => {
      const id = this.activeSessionId();
      if (id === null) {
        untracked(() => {
          if (!this.streaming()) {
          }
        });
      }
    });
  }

  protected onSelectSession(id: string): void {
    this.mode.set('detail');
    this.selectSession.emit(id);
  }

  protected onNewChat(): void {
    this.mode.set('detail');
    this.newChat.emit();
  }

  protected goBack(): void {
    this.mode.set('list');
  }

  enterDetail(): void {
    this.mode.set('detail');
  }
}
