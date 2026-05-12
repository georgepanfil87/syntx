import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NavGroup, Sidebar } from '../../components/sidebar/sidebar';
import { Resizer } from '../../../../shared/ui';
import { CommandPaletteService } from '../../../../core/services/command-palette/command-palette.service';
import {
  PreferencesService,
  SIDEBAR_COMPACT_THRESHOLD,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
} from '../../../../core/services/preferences/preferences.service';
import { AuthService } from '../../../auth/services/auth.service';
import { HealthService } from '../../../../core/services/health/health.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [Sidebar, Resizer, RouterModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private readonly auth = inject(AuthService);
  private readonly health = inject(HealthService);
  private readonly palette = inject(CommandPaletteService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefs = inject(PreferencesService);

  protected readonly backendStatus = signal<'unknown' | 'up' | 'down'>('unknown');

  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly sidebarWidth = signal<number>(this.prefs.sidebarWidth());

  private resizeAnchor = this.sidebarWidth();

  protected readonly compact = computed(() => this.sidebarWidth() < SIDEBAR_COMPACT_THRESHOLD);

  protected readonly paletteKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  protected readonly navGroups: NavGroup[] = [
    {
      labelKey: 'sidebar.workspace',
      items: [
        {
          labelKey: 'sidebar.dashboard',
          route: '/workspace',
          exact: true,
          icon: 'layout-dashboard',
        },
        {
          labelKey: 'sidebar.projects',
          route: '/workspace/projects',
          icon: 'folder',
        },
        {
          labelKey: 'sidebar.settings',
          route: '/workspace/settings',
          icon: 'settings',
        },
      ],
    },
    {
      labelKey: 'sidebar.admin',
      items: [
        {
          labelKey: 'sidebar.metrics',
          route: '/workspace/admin/metrics',
          icon: 'chart-line',
        },
      ],
    },
  ];

  constructor() {
    this.probe();

    if (typeof window !== 'undefined') {
      this.timerId = setInterval(() => this.probe(), 30_000);

      this.destroyRef.onDestroy(() => {
        if (this.timerId !== null) {
          clearInterval(this.timerId);
        }
      });
    }
  }

  protected reprobeBackend(): void {
    this.backendStatus.set('unknown');
    this.probe();
  }

  protected openPalette(): void {
    this.palette.show();
  }

  protected logout(): void {
    this.auth.logout();
  }

  private probe(): void {
    this.health.liveness().subscribe({
      next: () => this.backendStatus.set('up'),
      error: () => this.backendStatus.set('down'),
    });
  }

  protected onResizeStart(): void {
    this.resizeAnchor = this.prefs.sidebarWidth();
  }

  protected onResize(delta: number): void {
    const next = clampPx(this.resizeAnchor + delta, SIDEBAR_MIN, SIDEBAR_MAX);

    this.sidebarWidth.set(next);
  }

  protected onResizeCommit(): void {
    this.prefs.setSidebarWidth(this.sidebarWidth());
  }

  protected onResizeNudge(delta: number): void {
    const next = clampPx(this.sidebarWidth() + delta, SIDEBAR_MIN, SIDEBAR_MAX);

    this.sidebarWidth.set(next);
    this.prefs.setSidebarWidth(next);
  }
}

function clampPx(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;

  return Math.max(min, Math.min(max, value));
}
