import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface SelectOption {
  value: string;
  label?: string;
  hint?: string;
}

@Component({
  selector: 'sx-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [class.opacity-50]="disabled()" [class.pointer-events-none]="disabled()">
      <button
        type="button"
        role="combobox"
        [attr.aria-expanded]="open() ? 'true' : 'false'"
        [attr.aria-disabled]="disabled() ? 'true' : 'false'"
        (click)="toggle()"
        (keydown)="onTriggerKey($event)"
        class="w-full flex items-center justify-between gap-2 bg-background border border-border rounded-md px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/50 transition"
      >
        <span class="truncate" [class.text-muted-foreground]="!selectedLabel()">
          {{ selectedLabel() || placeholder() }}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          width="14"
          height="14"
          aria-hidden="true"
          class="shrink-0 transition-transform"
          [class.rotate-180]="open()"
        >
          <path
            d="M5 8l5 5 5-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      @if (open()) {
        <ul
          role="listbox"
          class="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg shadow-black/30 py-1 text-sm animate-fade-up"
        >
          @if (options().length === 0) {
            <li class="px-3 py-2 text-xs text-muted-foreground">
              {{ emptyHint() || 'No options' }}
            </li>
          }
          @for (opt of options(); track opt.value; let i = $index) {
            <li
              role="option"
              [attr.aria-selected]="opt.value === value() ? 'true' : 'false'"
              (click)="pick(opt.value)"
              (mouseenter)="highlight.set(i)"
              [class.bg-secondary]="highlight() === i || opt.value === value()"
              class="cursor-pointer px-3 py-1.5 flex items-center justify-between gap-3 hover:bg-secondary"
            >
              <span class="truncate">{{ opt.label || opt.value }}</span>
              @if (opt.hint) {
                <span class="text-[10px] text-muted-foreground font-mono shrink-0">{{
                  opt.hint
                }}</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Select {
  readonly options = input<readonly SelectOption[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input<string>('Select…');
  readonly disabled = input<boolean>(false);
  readonly emptyHint = input<string>('');

  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly highlight = signal<number>(-1);

  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    if (!v) return '';
    const match = this.options().find((o) => o.value === v);
    return match?.label || match?.value || v;
  });

  private readonly host = inject(ElementRef<HTMLElement>);

  @HostListener('document:click', ['$event'])
  protected onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) this.syncHighlightToSelection();
  }

  protected pick(v: string): void {
    if (v === this.value()) {
      this.open.set(false);
      return;
    }
    this.valueChange.emit(v);
    this.open.set(false);
  }

  protected onTriggerKey(ev: KeyboardEvent): void {
    if (this.disabled()) return;
    const opts = this.options();

    if (!this.open()) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.open.set(true);
        this.syncHighlightToSelection();
      }
      return;
    }

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.highlight.update((i) => Math.min(opts.length - 1, i + 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.highlight.update((i) => Math.max(0, i - 1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const idx = this.highlight();
      if (idx >= 0 && idx < opts.length) this.pick(opts[idx].value);
    }
  }

  private syncHighlightToSelection(): void {
    const idx = this.options().findIndex((o) => o.value === this.value());
    this.highlight.set(idx >= 0 ? idx : 0);
  }
}
