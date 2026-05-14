import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Icon } from '../../ui';
import { ToastService, Toast } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      @for (t of toasts(); track t.id) {
        <article [class]="cardClasses(t)" role="status">
          <div class="flex items-start gap-3 p-3">
            <span [class]="dotClasses(t)" aria-hidden="true"></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground">{{ t.title }}</p>
              @if (t.detail) {
                <p class="text-xs text-muted-foreground mt-0.5 break-words">{{ t.detail }}</p>
              }
            </div>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground transition rounded p-1"
              (click)="dismiss(t.id)"
            >
              <sx-icon name="x" [size]="14" ariaLabel="Dismiss" />
            </button>
          </div>
        </article>
      }
    </div>
  `,
})
export class ToastHost {
  private readonly svc = inject(ToastService);
  protected readonly toasts = this.svc.toasts;

  protected dismiss(id: number): void {
    this.svc.dismiss(id);
  }

  protected cardClasses(t: Toast): string {
    const base = 'pointer-events-auto rounded-lg border surface-elevated animate-fade-up';
    switch (t.level) {
      case 'success':
        return `${base} border-emerald-500/30`;
      case 'error':
        return `${base} border-destructive/40`;
      default:
        return `${base} border-border`;
    }
  }

  protected dotClasses(t: Toast): string {
    const base = 'mt-1.5 inline-block w-2 h-2 rounded-full shrink-0';
    switch (t.level) {
      case 'success':
        return `${base} bg-emerald-400`;
      case 'error':
        return `${base} bg-destructive`;
      default:
        return `${base} bg-primary`;
    }
  }
}
