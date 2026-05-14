import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'sx-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (_ of rows(); track $index) {
      <div
        class="animate-shimmer"
        [class.rounded-md]="shape() === 'line'"
        [class.rounded-full]="shape() === 'circle'"
        [class.rounded-xl]="shape() === 'block'"
        [style.height]="height()"
        [style.width]="widthFor($index)"
      ></div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--skel-gap, 0.5rem);
        width: 100%;
      }
    `,
  ],
})
export class Skeleton {
  readonly lines = input<number>(1);
  readonly height = input<string>('0.75rem');

  readonly widths = input<readonly string[]>(['100%']);
  readonly shape = input<'line' | 'block' | 'circle'>('line');

  protected readonly rows = computed(() => Array(Math.max(1, this.lines())).fill(0));

  protected widthFor(i: number): string {
    const ws = this.widths();
    return ws[i % ws.length];
  }
}
