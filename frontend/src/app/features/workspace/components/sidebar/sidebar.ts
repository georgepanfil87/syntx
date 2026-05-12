import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, inject, Input, OnInit, Output, signal } from '@angular/core';
import { Logo, Icon, Skeleton, IconName } from "../../../../shared/ui";

import { RouterModule } from '@angular/router';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../../auth/services/auth.service';

export interface NavItem {

  labelKey: string;
  route: string;
  exact?: boolean;
  icon: IconName;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

@Component({
  selector: 'sx-sidebar',
  imports: [Logo, Icon, Skeleton, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
 @Input({ required: true }) sidebarWidth!: number;
  @Input({ required: true }) compact!: boolean;

  @Input({ required: true })
  backendStatus!: 'unknown' | 'up' | 'down';

  @Input({ required: true })
  navGroups!: NavGroup[];

  @Input({ required: true })
  paletteKey!: string;

  @Output() openPalette = new EventEmitter<void>();
  @Output() reprobeBackend = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  protected readonly userMenuOpen = signal(false);

  constructor(
    protected readonly auth: AuthService,
    protected readonly i18n: I18nService,
  ) {}

  protected toggleUserMenu(ev: Event): void {
    ev.stopPropagation();
    this.userMenuOpen.update((v) => !v);
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

    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.userMenuOpen.set(false);
  }
}
