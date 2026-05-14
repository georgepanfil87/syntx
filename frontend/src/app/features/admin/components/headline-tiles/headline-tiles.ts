import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from '../../../../shared/ui';
import { AggregateOut } from '../../../../core/models/metrics.model';
import { formatMs, formatPercent } from '../../../../core/utils/metrics-format';

@Component({
  selector: 'headline-tiles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <sx-card variant="elevated">
        <p class="text-xs text-muted-foreground">Requests</p>
        <p class="text-2xl font-semibold mt-1 font-mono">{{ overall().count }}</p>
        <p class="text-[10px] text-muted-foreground mt-1">capacity {{ capacity() }}</p>
      </sx-card>
      <sx-card variant="elevated">
        <p class="text-xs text-muted-foreground">Success rate</p>
        <p class="text-2xl font-semibold mt-1 font-mono">
          {{ fmtPercent(overall().success_rate) }}
        </p>
        <p class="text-[10px] text-muted-foreground mt-1">2xx / total</p>
      </sx-card>
      <sx-card variant="elevated">
        <p class="text-xs text-muted-foreground">p50 latency</p>
        <p class="text-2xl font-semibold mt-1 font-mono">
          {{ fmtMs(overall().p50_ms) }}
        </p>
        <p class="text-[10px] text-muted-foreground mt-1">avg {{ fmtMs(overall().avg_ms) }}</p>
      </sx-card>
      <sx-card variant="elevated">
        <p class="text-xs text-muted-foreground">p95 latency</p>
        <p class="text-2xl font-semibold mt-1 font-mono">
          {{ fmtMs(overall().p95_ms) }}
        </p>
        <p class="text-[10px] text-muted-foreground mt-1">tail of distribution</p>
      </sx-card>
    </div>
  `,
})
export class HeadlineTiles {
  readonly overall = input.required<AggregateOut>();
  readonly capacity = input.required<number>();

  protected readonly fmtPercent = formatPercent;
  protected readonly fmtMs = formatMs;
}
