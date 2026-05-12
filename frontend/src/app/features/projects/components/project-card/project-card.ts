import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { Project } from '../../../../core/models/project.model';
import { Card, Icon } from "../../../../shared/ui";

@Component({
  selector: 'sx-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Icon],
  template: `
    <sx-card variant="elevated">
      <header
        slot="header"
        class="flex items-start justify-between gap-3 cursor-pointer"
        (click)="open()"
        (keydown.enter)="open()"
        tabindex="0"
        role="link"
      >
        <div class="min-w-0">
          <h3 class="text-sm font-semibold truncate">{{ project().name }}</h3>
          <p class="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
            {{ project().id }}
          </p>
        </div>
      </header>

      <div class="cursor-pointer" (click)="open()">
        @if (project().description) {
          <p class="text-sm text-muted-foreground line-clamp-2">{{ project().description }}</p>
        } @else {
          <p class="text-sm text-muted-foreground italic">{{ i18n.t('projectCard.noDescription') }}</p>
        }
      </div>

      <footer
        slot="footer"
        class="text-[11px] text-muted-foreground flex items-center justify-between gap-2"
      >
        <span>{{ i18n.t('projectCard.updated', { time: updatedAt() }) }}</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            (click)="onRename($event)"
            [attr.aria-label]="i18n.t('projectCard.renameAria')"
          >
            <sx-icon name="pencil" [size]="12" />
            <span>{{ i18n.t('projectCard.rename') }}</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            (click)="onDelete($event)"
            [disabled]="pending()"
            [attr.aria-label]="i18n.t('projectCard.deleteAria')"
          >
            <sx-icon name="trash" [size]="12" />
            <span>{{ i18n.t('projectCard.delete') }}</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-primary hover:bg-primary/10 transition"
            (click)="open()"
            [attr.aria-label]="i18n.t('projectCard.openAria')"
          >
            <span>{{ i18n.t('projectCard.open') }}</span>
            <sx-icon name="chevron-right" [size]="12" />
          </button>
        </div>
      </footer>
    </sx-card>
  `,
})
export class ProjectCard{
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly project = input.required<Project>();
  readonly pending = input<boolean>(false);

  readonly rename = output<Project>();
  readonly delete = output<Project>();

  protected readonly updatedAt = computed(() => {
    const d = new Date(this.project().updated_at);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  });

  protected open(): void {
    void this.router.navigate(['/workspace/projects', this.project().id]);
  }

  protected onRename(ev: Event): void {
    ev.stopPropagation();
    this.rename.emit(this.project());
  }

  protected onDelete(ev: Event): void {
    ev.stopPropagation();
    this.delete.emit(this.project());
  }
}
