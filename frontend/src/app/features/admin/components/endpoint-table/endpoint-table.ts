import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from '../../../../shared/ui';
import { AggregateOut } from '../../../../core/models/metrics.model';
import { formatMs, formatPercent } from '../../../../core/utils/metrics-format';

export interface EndpointRow {
  endpoint: string;
  agg: AggregateOut;
}

@Component({
  selector: 'endpoint-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <sx-card variant="elevated" [padding]="false">
      <header slot="header"><h2 class="text-sm font-semibold">Per endpoint</h2></header>
      @if (rows().length === 0) {
        <p class="text-xs text-muted-foreground italic px-5 py-6">No endpoint hits yet.</p>
      } @else {
        <table class="w-full text-xs">
          <thead class="text-muted-foreground border-b border-border">
            <tr class="text-left">
              <th class="px-4 py-2 font-medium">Endpoint</th>
              <th class="px-4 py-2 font-medium text-right">Count</th>
              <th class="px-4 py-2 font-medium text-right">Success</th>
              <th class="px-4 py-2 font-medium text-right">p50</th>
              <th class="px-4 py-2 font-medium text-right">p95</th>
              <th class="px-4 py-2 font-medium text-right">Avg</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.endpoint) {
              <tr class="border-t border-border/60">
                <td class="px-4 py-2 font-mono">{{ row.endpoint }}</td>
                <td class="px-4 py-2 text-right font-mono">{{ row.agg.count }}</td>
                <td class="px-4 py-2 text-right font-mono">
                  {{ fmtPercent(row.agg.success_rate) }}
                </td>
                <td class="px-4 py-2 text-right font-mono">{{ fmtMs(row.agg.p50_ms) }}</td>
                <td class="px-4 py-2 text-right font-mono">{{ fmtMs(row.agg.p95_ms) }}</td>
                <td class="px-4 py-2 text-right font-mono">{{ fmtMs(row.agg.avg_ms) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </sx-card>
  `,
})
export class EndpointTable {
  readonly rows = input.required<readonly EndpointRow[]>();

  protected readonly fmtPercent = formatPercent;
  protected readonly fmtMs = formatMs;
}
