import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card, Badge } from '../../../../shared/ui';
import { SampleOut } from '../../../../core/models/metrics.model';
import { formatMs, formatTime, statusVariant } from '../../../../core/utils/metrics-format';

@Component({
  selector: 'recent-samples',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Badge],
  template: `
    <sx-card variant="elevated" [padding]="false">
      <header slot="header" class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Recent samples</h2>
        <span class="text-[10px] text-muted-foreground">{{ samples().length }} shown</span>
      </header>
      @if (samples().length === 0) {
        <p class="text-xs text-muted-foreground italic px-5 py-6">The ring buffer is empty.</p>
      } @else {
        <ul class="divide-y divide-border max-h-96 overflow-auto">
          @for (s of samples(); track $index) {
            <li class="px-4 py-2 text-xs flex items-center gap-3">
              <span class="font-mono text-muted-foreground shrink-0">{{
                fmtTime(s.timestamp)
              }}</span>
              <span class="font-mono truncate flex-1">{{ s.endpoint }}</span>
              @if (s.model) {
                <span class="text-[10px] text-muted-foreground font-mono shrink-0">{{
                  s.model
                }}</span>
              }
              <sx-badge [variant]="badgeVariant(s.status)" size="sm">{{ s.status }}</sx-badge>
              <span class="font-mono text-muted-foreground shrink-0 w-16 text-right">
                {{ fmtMs(s.latency_ms) }}
              </span>
            </li>
          }
        </ul>
      }
    </sx-card>
  `,
})
export class RecentSamples {
  readonly samples = input.required<readonly SampleOut[]>();

  protected readonly fmtMs = formatMs;
  protected readonly fmtTime = formatTime;
  protected readonly badgeVariant = statusVariant;
}
