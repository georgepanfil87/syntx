import { ChangeDetectionStrategy, Component, computed, input, isDevMode } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'sx-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      [attr.aria-label]="ariaLabel() || null"
      [class]="classes()"
    >
      @if (loading()) {
        <span
          class="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        ></span>
      } @else {
        <ng-content select="[slot=leading]" />
      }
      <span [class]="iconOnly() ? 'sr-only' : 'inline-flex items-center'">
        <ng-content />
      </span>
      <ng-content select="[slot=trailing]" />
    </button>
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly iconOnly = input<boolean>(false);
  readonly ariaLabel = input<string>('');

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium ' +
      'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
      'disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeClasses = this.iconOnly() ? this.iconOnlySize() : this.regularSize();

    const variantClasses = this.variantClasses();
    const widthClasses = this.fullWidth() ? 'w-full' : '';
    const radiusClasses = this.size() === 'lg' ? 'rounded-lg' : 'rounded-md';

    if (isDevMode() && this.iconOnly() && !this.ariaLabel()) {
      console.warn(
        '[app-button] iconOnly requires ariaLabel — screen readers cannot announce icon-only buttons.',
      );
    }

    return [base, sizeClasses, variantClasses, radiusClasses, widthClasses]
      .filter(Boolean)
      .join(' ');
  });

  private regularSize(): string {
    switch (this.size()) {
      case 'sm':
        return 'h-8 px-3 text-xs';
      case 'lg':
        return 'h-11 px-6 text-base';
      default:
        return 'h-9 px-4 text-sm';
    }
  }

  private iconOnlySize(): string {
    switch (this.size()) {
      case 'sm':
        return 'h-8 w-8 text-sm';
      case 'lg':
        return 'h-11 w-11 text-lg';
      default:
        return 'h-9 w-9 text-sm';
    }
  }

  private variantClasses(): string {
    switch (this.variant()) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:opacity-90';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground border border-border hover:border-primary/50';
      case 'ghost':
        return 'bg-transparent text-foreground hover:bg-secondary';
      case 'destructive':
        return 'bg-destructive text-destructive-foreground hover:opacity-90';
      case 'link':
        return 'bg-transparent text-primary underline-offset-4 hover:underline';
    }
  }
}
