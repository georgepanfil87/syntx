import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { MetricsApi } from '../../../../core/services/metrics/metrics-api.service';
import { MetricsResponse } from '../../../../core/models/metrics.model';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { EndpointRow, HeadlineTiles, EndpointTable, RecentSamples } from '../../components';
import { Button } from "../../../../shared/ui";

const REFRESH_MS = 5_000;

@Component({
  selector: 'sx-metrics',
  imports: [Button, HeadlineTiles, EndpointTable, RecentSamples],
  templateUrl: './metrics.html',
  styleUrl: './metrics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Metrics implements OnInit {
  private readonly api = inject(MetricsApi);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<MetricsResponse | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly autoRefresh = signal<boolean>(false);

  protected readonly recentSamples = computed(() =>
    [...(this.data()?.samples ?? [])].reverse().slice(0, 50),
  );

  protected readonly endpointRows = computed<EndpointRow[]>(() => {
    const map = this.data()?.by_endpoint ?? {};
    return Object.entries(map)
      .map(([endpoint, agg]) => ({ endpoint, agg }))
      .sort((a, b) => b.agg.count - a.agg.count);
  });

  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const on = this.autoRefresh();
      untracked(() => this.setTimer(on));
    });
    this.destroyRef.onDestroy(() => this.setTimer(false));
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.snapshot().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toasts.error('Metrics', { detail: 'Refresh failed.' });
      },
    });
  }

  private setTimer(on: boolean): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (on && typeof window !== 'undefined') {
      this.timerId = setInterval(() => this.reload(), REFRESH_MS);
    }
  }
}
