import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'destructive' | 'outline';

export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'sx-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()"><ng-content /></span>`,
})
export class Badge {
  readonly variant = input<BadgeVariant>('default');
  readonly size = input<BadgeSize>('sm');

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center gap-1 rounded-full font-medium border ' +
      (this.size() === 'md' ? 'text-xs px-2.5 py-0.5' : 'text-[10px] px-2 py-0.5');

    switch (this.variant()) {
      case 'info':
        return `${base} bg-primary/12 text-primary border-primary/30`;
      case 'success':
        return `${base} bg-emerald-500/12 text-emerald-300 border-emerald-500/30`;
      case 'warning':
        return `${base} bg-amber-500/12 text-amber-300 border-amber-500/30`;
      case 'destructive':
        return `${base} bg-destructive/15 text-destructive border-destructive/30`;
      case 'outline':
        return `${base} bg-transparent text-muted-foreground border-border`;
      default:
        return `${base} bg-secondary text-secondary-foreground border-border`;
    }
  });
}
