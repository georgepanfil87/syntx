import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, IconName } from '../../ui';

@Component({
  selector: 'empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="flex flex-col items-center text-center gap-3 max-w-md mx-auto py-10">
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center bg-secondary text-muted-foreground"
      >
        <ng-content select="[slot=icon]" />
        @if (resolvedIcon(); as ic) {
          <sx-icon [name]="ic" [size]="20" />
        }
      </div>

      <h3 class="text-base font-semibold text-foreground">{{ title() }}</h3>

      @if (body()) {
        <p class="text-sm text-muted-foreground text-balance">{{ body() }}</p>
      }
      <div class="text-sm text-muted-foreground"><ng-content /></div>

      <div class="pt-1">
        <ng-content select="[slot=action]" />
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly iconName = input<IconName | null>(null);

  protected readonly resolvedIcon = computed<IconName | null>(() => this.iconName() ?? null);
}
