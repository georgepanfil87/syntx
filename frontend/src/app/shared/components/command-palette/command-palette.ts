import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CommandPaletteService } from '../../../core/services/command-palette/command-palette.service';


@Component({
  selector: 'command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (palette.open()) {
      <div
        class="fixed inset-0 z-[1200] flex items-start justify-center p-4 pt-[15vh] bg-background/70 backdrop-blur-sm"
        (click)="palette.hide()"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div
          class="rounded-xl border border-border w-full max-w-xl overflow-hidden surface-elevated animate-fade-up"
          (click)="$event.stopPropagation()"
        >
          <input
            #queryInput
            type="text"
            [ngModel]="palette.query()"
            (ngModelChange)="palette.setQuery($event)"
            (keydown.arrowDown)="onArrow($event, 1)"
            (keydown.arrowUp)="onArrow($event, -1)"
            (keydown.enter)="onEnter($event)"
            placeholder="Type a command or search…"
            class="w-full bg-transparent border-b border-border px-4 py-3 text-sm focus:outline-none placeholder:text-muted-foreground"
            autocomplete="off"
            spellcheck="false"
          />

          <div class="max-h-[55vh] overflow-y-auto py-1">
            @if (palette.results().length === 0) {
              <p class="px-4 py-6 text-center text-xs text-muted-foreground">
                No commands match.
              </p>
            }

            @for (cmd of palette.results(); let i = $index; track cmd.id) {
              @if (showsGroupHeader(i)) {
                <div
                  class="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ cmd.group }}
                </div>
              }
              <button
                type="button"
                (click)="onClick(i)"
                (mouseenter)="palette.setSelectedIndex(i)"
                [class.bg-secondary]="i === palette.selectedIndex()"
                class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-secondary transition"
              >
                <span class="truncate">{{ cmd.title }}</span>
                @if (cmd.hint) {
                  <span class="shrink-0 text-[10px] text-muted-foreground">{{ cmd.hint }}</span>
                }
              </button>
            }
          </div>

          <div
            class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-3"
          >
            <span><kbd class="font-mono">↑</kbd> <kbd class="font-mono">↓</kbd> navigate</span>
            <span><kbd class="font-mono">↵</kbd> run</span>
            <span><kbd class="font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPalette implements AfterViewChecked {
  protected readonly palette = inject(CommandPaletteService);

  @ViewChild('queryInput') private queryInput?: ElementRef<HTMLInputElement>;

  private focusedThisOpen = false;

  constructor() {

    effect(() => {
      if (!this.palette.open()) this.focusedThisOpen = false;
    });
  }

  ngAfterViewChecked(): void {
    if (this.palette.open() && !this.focusedThisOpen && this.queryInput) {
      this.queryInput.nativeElement.focus();
      this.focusedThisOpen = true;
    }
  }

  protected readonly groups = computed(() =>
    this.palette.results().map((c) => c.group),
  );

  protected showsGroupHeader(i: number): boolean {
    const groups = this.groups();
    if (i === 0) return true;
    return groups[i] !== groups[i - 1];
  }

  protected onArrow(ev: Event, delta: number): void {
    ev.preventDefault();
    this.palette.move(delta);
  }

  protected onEnter(ev: Event): void {
    ev.preventDefault();
    void this.palette.runSelected();
  }

  protected onClick(i: number): void {
    this.palette.setSelectedIndex(i);
    void this.palette.runSelected();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.palette.open()) this.palette.hide();
  }
}
