import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { Project } from '../../../../core/models/project.model';
import {
  ProjectsActions,
  selectIsProjectPending,
  selectProjectsError,
} from '../../../../core/state/projects';
import { Modal, InputComponent, Textarea, Button } from '../../../../shared/ui';

@Component({
  selector: 'sx-project-rename-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, InputComponent, Textarea, Button],
  template: `
    <sx-modal [open]="open()" [title]="i18n.t('projectRename.title')" (close)="cancel()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <sx-input
          formControlName="name"
          [label]="i18n.t('projectRename.nameLabel')"
          [placeholder]="i18n.t('projectCreate.namePlaceholder')"
          autocomplete="off"
          [error]="nameError()"
        />

        <sx-textarea
          formControlName="description"
          [label]="i18n.t('projectCreate.descriptionLabel')"
          [placeholder]="i18n.t('projectCreate.descriptionPlaceholder')"
          [minRows]="3"
          [maxRows]="6"
          [error]="descriptionError()"
        />

        @if (storeError()) {
          <p class="text-xs text-destructive" role="alert">{{ storeError() }}</p>
        }
      </form>

      <div slot="footer">
        <sx-button variant="ghost" (click)="cancel()">{{ i18n.t('common.cancel') }}</sx-button>
        <sx-button type="submit" (click)="submit()" [loading]="pending()">
          {{ i18n.t('projectRename.submit') }}
        </sx-button>
      </div>
    </sx-modal>
  `,
})
export class ProjectRenameModal {
  readonly open = input<boolean>(false);
  readonly project = input<Project | null>(null);
  readonly close = output<void>();

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly storeError = this.store.selectSignal(selectProjectsError);

  protected readonly pending = computed(() => {
    const id = this.project()?.id;
    if (!id) return false;
    return this.store.selectSignal(selectIsProjectPending(id))();
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    effect(() => {
      const proj = this.project();
      if (this.open() && proj) {
        untracked(() =>
          this.form.reset({
            name: proj.name,
            description: proj.description ?? '',
          }),
        );
      }
    });
  }

  protected nameError(): string {
    const c = this.form.controls.name;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Name is required.';
    if (c.errors['maxlength']) return 'Name must be 120 characters or fewer.';
    return '';
  }

  protected descriptionError(): string {
    const c = this.form.controls.description;
    if (!c.touched || !c.errors) return '';
    if (c.errors['maxlength']) return 'Description must be 2000 characters or fewer.';
    return '';
  }

  protected submit(): void {
    const proj = this.project();
    if (!proj || this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    // Build a partial body — only include fields that actually changed.
    // Avoids needless PATCH-of-same-value writes the server happily
    // accepts but that pollute audit logs and updated_at timestamps.
    const changes: { name?: string; description?: string | null } = {};
    if (trimmedName !== proj.name) changes.name = trimmedName;

    const nextDescription = trimmedDescription || null;
    if (nextDescription !== (proj.description ?? null)) {
      changes.description = nextDescription;
    }

    if (Object.keys(changes).length === 0) {
      this.cancel();
      return;
    }
    this.store.dispatch(ProjectsActions.updateProject({ id: proj.id, changes }));
  }

  protected cancel(): void {
    this.close.emit();
  }
}
