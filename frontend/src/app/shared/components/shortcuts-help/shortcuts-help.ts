import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import {
  KeyboardShortcutsService,
  ShortcutDef,
} from '../../../core/services/shortcuts/keyboard-shortcuts.service';
import { ShortcutsHelpService } from '../../../core/services/shortcuts/shortcuts-help.service';

@Component({
  selector: 'shortcuts-help',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (help.open()) {
      <div
        class="fixed inset-0 z-[1150] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
        (click)="help.hide()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
      >
        <div
          class="rounded-xl border border-border max-w-lg w-full p-5 space-y-4 surface-elevated animate-fade-up"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-center justify-between">
            <h2 id="shortcuts-help-title" class="text-base font-semibold">Keyboard shortcuts</h2>
            <button
              type="button"
              (click)="help.hide()"
              class="text-xs text-muted-foreground hover:text-foreground transition"
              aria-label="Close"
            >
              Esc
            </button>
          </header>

          @if (groups().length === 0) {
            <p class="text-xs text-muted-foreground">No shortcuts registered.</p>
          }

          @for (g of groups(); track g.name) {
            <section class="space-y-1.5">
              <h3 class="text-[10px] uppercase tracking-wider text-primary">{{ g.name }}</h3>
              <ul class="space-y-1">
                @for (s of g.items; track s.id) {
                  <li class="flex items-center justify-between gap-3 text-sm">
                    <span class="text-muted-foreground">{{ s.description }}</span>
                    <kbd
                      class="font-mono text-[11px] rounded border border-border px-1.5 py-0.5 bg-secondary"
                      >{{ formatKey(s.keys) }}</kbd
                    >
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      </div>
    }
  `,
})
export class ShortcutsHelp {
  private readonly shortcuts = inject(KeyboardShortcutsService);
  protected readonly help = inject(ShortcutsHelpService);

  protected readonly groups = computed<{ name: string; items: ShortcutDef[] }[]>(() => {
    const all = this.shortcuts.shortcuts().filter((s) => (s.when ? s.when() : true));
    const map = new Map<string, ShortcutDef[]>();
    for (const s of all) {
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  protected formatKey(spec: string): string {
    return KeyboardShortcutsService.formatKeyspec(spec);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.help.open()) this.help.hide();
  }
}
