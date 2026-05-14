import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  computed,
  effect,
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
    <div [class.opacity-50]="disabled()" [class.pointer-events-none]="disabled()">
      <button
        #trigger
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
    </div>

    <ng-template #panelTpl>
      <ul
        #panel
        role="listbox"
        class="fixed z-[1000] max-h-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg shadow-black/30 py-1 text-sm animate-fade-up"
        [style.top.px]="panelRect().top"
        [style.left.px]="panelRect().left"
        [style.width.px]="panelRect().width"
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
    </ng-template>
  `,
})
export class Select implements AfterViewInit, OnDestroy {
  readonly options = input<readonly SelectOption[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input<string>('Select…');
  readonly disabled = input<boolean>(false);
  readonly emptyHint = input<string>('');

  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly highlight = signal<number>(-1);
  protected readonly panelRect = signal<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  @ViewChild('trigger', { static: true })
  private readonly triggerRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('panelTpl', { static: true })
  private readonly panelTpl!: TemplateRef<unknown>;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly vcr = inject(ViewContainerRef);

  private embeddedView?: EmbeddedViewRef<unknown>;

  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    if (!v) return '';
    const match = this.options().find((o) => o.value === v);
    return match?.label || match?.value || v;
  });

  private readonly onAnyScroll = (ev: Event): void => {
    const panel = this.panelNode();
    if (panel && ev.target instanceof Node && panel.contains(ev.target)) return;
    this.open.set(false);
  };

  constructor() {
    effect(() => {
      if (this.open()) this.attachPanel();
      else this.detachPanel();
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.detachPanel();
  }

  // Public API

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  protected pick(v: string): void {
    if (v !== this.value()) this.valueChange.emit(v);
    this.open.set(false);
  }

  protected onTriggerKey(ev: KeyboardEvent): void {
    if (this.disabled()) return;
    const opts = this.options();

    if (!this.open()) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.open.set(true);
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

  //  Host listeners

  @HostListener('document:click', ['$event'])
  protected onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as Node;
    if (this.host.nativeElement.contains(target)) return;
    if (this.panelNode()?.contains(target)) return;
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.open()) this.updatePanelRect();
  }

  // Internals

  private attachPanel(): void {
    if (this.embeddedView) return;
    this.embeddedView = this.vcr.createEmbeddedView(this.panelTpl);
    for (const node of this.embeddedView.rootNodes as Node[]) {
      document.body.appendChild(node);
    }
    this.syncHighlightToSelection();
    this.updatePanelRect();
    this.embeddedView.detectChanges();
    document.addEventListener('scroll', this.onAnyScroll, true);
  }

  /** Destroy the embedded view — Angular removes its nodes from the DOM. */
  private detachPanel(): void {
    if (!this.embeddedView) return;
    document.removeEventListener('scroll', this.onAnyScroll, true);
    this.embeddedView.destroy();
    this.embeddedView = undefined;
  }

  /** Resolves the panel's root DOM node, if currently attached. */
  private panelNode(): HTMLElement | undefined {
    const node = this.embeddedView?.rootNodes?.[0];
    return node instanceof HTMLElement ? node : undefined;
  }

  /**
    Open the panel directly under the trigger, matching its width. 
   */
  private updatePanelRect(): void {
    const el = this.triggerRef.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const left = Math.min(rect.left, window.innerWidth - rect.width - margin);
    this.panelRect.set({
      top: rect.bottom + gap,
      left: Math.max(margin, left),
      width: rect.width,
    });
  }

  /** Surface the current selection as the highlighted row on open. */
  private syncHighlightToSelection(): void {
    const idx = this.options().findIndex((o) => o.value === this.value());
    this.highlight.set(idx >= 0 ? idx : 0);
  }
}
