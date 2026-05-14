import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { ENVIRONMENT } from '../../../../core/config/environment';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TokenStorageService } from '../../../../core/services/token-storage/token-storage.service';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Icon } from '../../../../shared/ui';
@Component({
  selector: 'terminal-modal',
  imports: [Icon],
  templateUrl: './terminal-modal.html',
  styleUrl: './terminal-modal.css',
  host: { class: 'flex flex-col h-full min-h-0 bg-card/30' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalModal implements AfterViewInit, OnDestroy {
  readonly open = input<boolean>(true);
  readonly projectId = input<string>('');
  readonly close = output<void>();
  readonly filesChanged = output<void>();

  @ViewChild('host') private hostRef?: ElementRef<HTMLDivElement>;

  private readonly tokens = inject(TokenStorageService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle');

  private term?: Terminal;
  private fit?: FitAddon;
  private ws?: WebSocket;
  private onWindowResize = (): void => this.refit();
  private connectedProjectId = '';

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const pid = this.projectId();
      if (!isOpen || !pid) return;
      if (pid === this.connectedProjectId) return;
      untracked(() => {
        setTimeout(() => {
          if (this.connectedProjectId !== pid) {
            this.reconnect(pid);
          }
        }, 0);
      });
    });
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.onWindowResize);
    this.ensureTerminal();
    this.refit();
    this.term?.focus();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onWindowResize);
    this.closeSocket();
    this.term?.dispose();
    this.term = undefined;
  }

  // User actions

  protected onClear(): void {
    this.term?.clear();
  }

  // Socket lifecycle

  private reconnect(projectId: string): void {
    this.closeSocket();
    this.ensureTerminal();
    this.connectedProjectId = projectId;
    const token = this.tokens.read();
    if (!token) {
      this.status.set('error');
      this.term?.writeln(`\r\n\x1b[31m${this.i18n.t('terminal.notAuthenticated')}\x1b[0m`);
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}${ENVIRONMENT.apiBaseUrl}/projects/${projectId}/terminal?token=${encodeURIComponent(token)}`;
    this.status.set('connecting');
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.status.set('open');

      this.refit();

      this.term?.focus();

      try {
        ws.send(JSON.stringify({ type: 'input', data: '\n' }));
      } catch {}
    };
    ws.onmessage = (ev) => {
      let msg: { type?: string; data?: string; code?: number } | undefined;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg?.type === 'output' && typeof msg.data === 'string') {
        this.term?.write(msg.data);
      } else if (msg?.type === 'exit') {
        this.term?.writeln(
          `\r\n\x1b[33m${this.i18n.t('terminal.exited', { code: msg.code ?? 0 })}\x1b[0m`,
        );
      } else if (msg?.type === 'files_changed') {
        this.filesChanged.emit();
      }
    };
    ws.onerror = () => this.status.set('error');
    ws.onclose = () => {
      this.status.set('closed');
      this.filesChanged.emit();
    };
  }

  private closeSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = undefined;
    }
  }

  // Terminal lifecycle

  private ensureTerminal(): void {
    if (this.term || !this.hostRef) return;
    this.term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#000000',
        foreground: '#e5e7eb',
        cursor: '#a78bfa',
        selectionBackground: 'rgba(167, 139, 250, 0.3)',
      },
      scrollback: 10_000,
      convertEol: true,
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.open(this.hostRef.nativeElement);
    this.term.onData((data) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input', data }));
      }
    });
    this.term.onResize(({ cols, rows }) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
  }

  private refit(): void {
    if (!this.open() || !this.fit || !this.term) return;
    try {
      this.fit.fit();
    } catch {}
  }

  protected statusLabel(): string {
    switch (this.status()) {
      case 'idle':
        return this.i18n.t('terminal.statusIdle');
      case 'connecting':
        return this.i18n.t('terminal.statusConnecting');
      case 'open':
        return this.i18n.t('terminal.statusOpen');
      case 'closed':
        return this.i18n.t('terminal.statusClosed');
      case 'error':
        return this.i18n.t('terminal.statusError');
    }
  }
}
