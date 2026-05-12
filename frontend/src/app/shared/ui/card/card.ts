import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CardVariant = 'default' | 'elevated' | 'glass';
@Component({
  selector: 'sx-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [class]="rootClasses()">
      <div class="card-header">
        <ng-content select="[slot=header]" />
      </div>

      <div [class]="bodyClasses()">
        <ng-content />
      </div>

      <div class="card-footer">
        <ng-content select="[slot=footer]" />
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      article {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .card-header:empty,
      .card-footer:empty {
        display: none;
      }
      .card-header:not(:empty) {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid hsl(var(--border));
      }
      .card-footer:not(:empty) {
        padding: 0.75rem 1rem;
        border-top: 1px solid hsl(var(--border));
      }
    `,
  ],
})
export class Card {
  readonly variant = input<CardVariant>('default');
  readonly padding = input<boolean>(true);
  readonly fill = input<boolean>(false);

  protected readonly rootClasses = computed(() => {
    const base = 'rounded-xl border border-border overflow-hidden';
    const layout = this.fill() ? 'flex flex-col h-full' : '';
    let surface: string;
    switch (this.variant()) {
      case 'elevated':
        surface = 'surface-elevated';
        break;
      case 'glass':
        surface = 'bg-popover/70 backdrop-blur-md';
        break;
      default:
        surface = 'bg-card';
    }
    return [base, surface, layout].filter(Boolean).join(' ');
  });

  protected readonly bodyClasses = computed(() => {
    const padding = this.padding() ? 'p-4 sm:p-5' : '';

    const layout = this.fill() ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : '';
    return [padding, layout].filter(Boolean).join(' ').trim();
  });
}
