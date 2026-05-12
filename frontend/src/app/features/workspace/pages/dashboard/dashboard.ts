import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { MetricsResponse } from '../../../../core/models/metrics.model';
import { AuthService } from '../../../auth/services/auth.service';
import { Card, Icon, Badge } from '../../../../shared/ui';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { MetricsApi } from '../../../../core/services/metrics/metrics-api.service';
import {
  selectAllProjects,
  selectProjectsLoading,
  ProjectsActions,
} from '../../../../core/state/projects';

@Component({
  selector: 'app-dashboard',
  imports: [Card, Icon, Badge, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly store = inject(Store);
  private readonly metricsApi = inject(MetricsApi);

  protected readonly projects = this.store.selectSignal(selectAllProjects);
  protected readonly projectsLoading = this.store.selectSignal(selectProjectsLoading);

  protected readonly metrics = signal<MetricsResponse | null>(null);
  protected readonly metricsLoading = signal<boolean>(false);

  protected readonly projectCount = computed(() => this.projects().length);

  protected readonly recentProjects = computed(() => {
    return [...this.projects()].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5);
  });

  ngOnInit(): void {
    this.store.dispatch(ProjectsActions.loadProjects({}));

    this.metricsLoading.set(true);
    this.metricsApi.snapshot(50).subscribe({
      next: (res) => {
        this.metrics.set(res);
        this.metricsLoading.set(false);
      },
      error: () => {
        this.metricsLoading.set(false);
      },
    });
  }

  protected greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return this.i18n.t('dashboard.greetLateNight');
    if (h < 12) return this.i18n.t('dashboard.greetMorning');
    if (h < 18) return this.i18n.t('dashboard.greetAfternoon');
    return this.i18n.t('dashboard.greetEvening');
  }

  protected userName(email: string | undefined | null): string {
    const local = email?.split('@')[0] ?? '';
    if (!local) return '?';
    const segments = local.split(/[._-]/).filter(Boolean);
    const head = segments[0] ?? local[0] ?? '?';
    const tail = segments[1] ?? '';
    return (
      head[0].toUpperCase() +
      head.slice(1) +
      (tail ? ` ${tail[0].toUpperCase() + tail.slice(1)}` : '')
    );
  }

  //  Formatters
  protected formatMs(ms: number | undefined | null): string {
    if (ms == null || !Number.isFinite(ms) || ms === 0) return '—';
    if (ms < 1) return `${ms.toFixed(2)}ms`;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  protected formatPercent(rate: number | undefined | null): string {
    if (rate == null || !Number.isFinite(rate)) return '—';
    return `${(rate * 100).toFixed(1)}%`;
  }

  protected relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diffMs = Date.now() - then;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(then));
  }
}
