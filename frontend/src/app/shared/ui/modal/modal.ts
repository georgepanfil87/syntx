import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { Icon } from '../icon/icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'sx-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
        (click)="onBackdrop()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || 'Dialog'"
      >
        <div [class]="cardClasses()" (click)="$event.stopPropagation()">
          @if (title() || hasHeaderSlot) {
            <header class="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 class="text-base font-semibold text-foreground">
                <ng-content select="[slot=header]" />
                @if (title()) {
                  {{ title() }}
                }
              </h2>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground transition rounded p-1"
                (click)="emitClose()"
              >
                <sx-icon name="x" ariaLabel="Close" />
              </button>
            </header>
          }

          <div class="px-5 py-4 text-sm text-foreground">
            <ng-content />
          </div>

          <div class="modal-footer-slot">
            <ng-content select="[slot=footer]" />
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .modal-footer-slot:not(:empty) {
        padding: 0.75rem 1.25rem;
        border-top: 1px solid hsl(var(--border));
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class Modal {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly closeOnBackdrop = input<boolean>(true);
  readonly closeOnEscape = input<boolean>(true);

  readonly close = output<void>();

  protected readonly hasHeaderSlot = false;

  protected readonly cardClasses = computed(() => {
    const max =
      this.size() === 'sm'
        ? 'max-w-sm'
        : this.size() === 'lg'
          ? 'max-w-2xl'
          : this.size() === 'xl'
            ? 'max-w-4xl'
            : 'max-w-md';
    return `w-full ${max} rounded-xl border border-border surface-elevated overflow-hidden animate-fade-up`;
  });

  protected onBackdrop(): void {
    if (this.closeOnBackdrop()) this.emitClose();
  }

  protected emitClose(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open() && this.closeOnEscape()) this.emitClose();
  }
}
