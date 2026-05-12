import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Resizer, Logo, Icon, Skeleton, IconName } from '../../../../shared/ui';
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
import { I18nService } from '../../../../core/i18n/i18n.service';

interface NavItem {
  labelKey: string;
  route: string;
  exact?: boolean;
  icon: IconName;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}
@Component({
  selector: 'app-layout',
  imports: [RouterModule, Logo, Icon, Skeleton, Resizer],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly health = inject(HealthService);
  private readonly palette = inject(CommandPaletteService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefs = inject(PreferencesService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly backendStatus = signal<'unknown' | 'up' | 'down'>('unknown');
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly sidebarWidth = signal<number>(this.prefs.sidebarWidth());
  private resizeAnchor = this.sidebarWidth();
  protected readonly compact = computed<boolean>(
    () => this.sidebarWidth() < SIDEBAR_COMPACT_THRESHOLD,
  );

  protected readonly userMenuOpen = signal<boolean>(false);

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
        { labelKey: 'sidebar.projects', route: '/workspace/projects', icon: 'folder' },
        { labelKey: 'sidebar.settings', route: '/workspace/settings', icon: 'settings' },
      ],
    },
    {
      labelKey: 'sidebar.admin',
      items: [
        { labelKey: 'sidebar.metrics', route: '/workspace/admin/metrics', icon: 'chart-line' },
      ],
    },
  ];

  ngOnInit(): void {
    this.probe();
    if (typeof window !== 'undefined') {
      this.timerId = setInterval(() => this.probe(), 30_000);
      this.destroyRef.onDestroy(() => {
        if (this.timerId !== null) clearInterval(this.timerId);
      });
    }
  }

  private probe(): void {
    this.health.liveness().subscribe({
      next: () => this.backendStatus.set('up'),
      error: () => this.backendStatus.set('down'),
    });
  }

  protected reprobeBackend(): void {
    this.backendStatus.set('unknown');
    this.probe();
  }

  protected openPalette(): void {
    this.palette.show();
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
  }

  protected initials(email: string): string {
    const local = email.split('@')[0] ?? '';
    if (!local) return '?';
    const segments = local.split(/[._-]/).filter(Boolean);
    const head = segments[0]?.[0] ?? local[0] ?? '?';
    const tail = segments[1]?.[0] ?? '';
    return (head + tail).toUpperCase();
  }

  protected displayName(email: string): string {
    const local = email.split('@')[0] ?? '';
    if (!local) return email;
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length === 0) return local;
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  // Resize handlers
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

  // User menu handlers
  protected toggleUserMenu(ev: Event): void {
    ev.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = ev.target as Node | null;
    if (!target) {
      this.userMenuOpen.set(false);
      return;
    }
    const popoverEl = this.host.nativeElement.querySelector('[role="dialog"]');
    const triggerEl = this.host.nativeElement.querySelector('[aria-haspopup="dialog"]');
    if (popoverEl?.contains(target) || triggerEl?.contains(target)) return;
    this.userMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
  }
}

function clampPx(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
