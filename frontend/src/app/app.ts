import { Component, effect, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { KeyboardShortcutsService } from './core/services/shortcuts/keyboard-shortcuts.service';
import { AuthService } from './features/auth/services/auth.service';
import { PreferencesService } from './core/services/preferences/preferences.service';
import { CommandPalette } from './shared/components/command-palette/command-palette';
import { ShortcutsHelp } from './shared/components/shortcuts-help/shortcuts-help';
import { ToastHost, ConfirmDialog } from './shared/components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommandPalette, ShortcutsHelp, ToastHost, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly prefs = inject(PreferencesService);
  private readonly i18n = inject(I18nService);

  constructor() {
    this.auth.bootstrap().subscribe();
    effect(() => {
      this.i18n.setLang(this.prefs.language());
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(ev: KeyboardEvent): void {
    if (this.shortcuts.dispatch(ev)) {
      ev.preventDefault();
    }
  }
}
