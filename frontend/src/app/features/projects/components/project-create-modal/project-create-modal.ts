import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';

import { I18nService } from '../../../../core/i18n/i18n.service';
import {
  ProjectsActions,
  selectProjectsCreating,
  selectProjectsError,
} from '../../../../core/state/projects';
import { Modal, Button, InputComponent, Textarea } from '../../../../shared/ui';

@Component({
  selector: 'sx-project-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Button, InputComponent, Textarea],
  template: `
    <sx-modal [open]="open()" [title]="i18n.t('projectCreate.title')" (close)="cancel()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <sx-input
          formControlName="name"
          [label]="i18n.t('projectCreate.nameLabel')"
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
        <sx-button type="submit" (click)="submit()" [loading]="creating()">
          {{ i18n.t('projectCreate.submit') }}
        </sx-button>
      </div>
    </sx-modal>
  `,
})
export class ProjectCreateModal {
  readonly open = input<boolean>(false);
  readonly close = output<void>();

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly creating = this.store.selectSignal(selectProjectsCreating);
  protected readonly storeError = this.store.selectSignal(selectProjectsError);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.form.reset({ name: '', description: '' }));
      }
    });
  }

  protected nameError(): string {
    const c = this.form.controls.name;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Name is required.';
    if (c.errors['maxlength']) return 'Name must be 80 characters or fewer.';
    return '';
  }

  protected descriptionError(): string {
    const c = this.form.controls.description;
    if (!c.touched || !c.errors) return '';
    if (c.errors['maxlength']) return 'Description must be 500 characters or fewer.';
    return '';
  }

  protected submit(): void {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.store.dispatch(
      ProjectsActions.createProject({
        payload: {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
        },
      }),
    );
  }

  protected cancel(): void {
    this.close.emit();
  }
}
