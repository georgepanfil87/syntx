import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Logo, Button, Icon, Badge, InputComponent } from '../../../../shared/ui';
import { Router, RouterModule } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../services/auth.service';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

interface PasswordCriterion {
  key: 'length' | 'uppercase' | 'lowercase' | 'digit' | 'symbol';
  label: string;
  met: boolean;
}

@Component({
  selector: 'app-register',
  imports: [Logo, Button, Icon, Badge, InputComponent, RouterModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN),
          Validators.maxLength(PASSWORD_MAX),
          passwordComplexityValidator,
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator] },
  );

  protected readonly formError = signal<string>('');

  protected readonly year = new Date().getFullYear();

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly criteria = computed<PasswordCriterion[]>(() => {
    const v = this.passwordValue() ?? '';
    return [
      {
        key: 'length',
        label: this.i18n.t('auth.register.criteriaLengthShort'),
        met: v.length >= PASSWORD_MIN,
      },
      {
        key: 'uppercase',
        label: this.i18n.t('auth.register.criteriaUppercaseShort'),
        met: /[A-Z]/.test(v),
      },
      {
        key: 'lowercase',
        label: this.i18n.t('auth.register.criteriaLowercaseShort'),
        met: /[a-z]/.test(v),
      },
      {
        key: 'digit',
        label: this.i18n.t('auth.register.criteriaDigitShort'),
        met: /[0-9]/.test(v),
      },
      {
        key: 'symbol',
        label: this.i18n.t('auth.register.criteriaSymbolShort'),
        met: /[^A-Za-z0-9]/.test(v),
      },
    ];
  });

  protected readonly emailError = computed(() =>
    fieldError(this.form.controls.email, {
      required: this.i18n.t('auth.login.emailRequired'),
      email: this.i18n.t('auth.login.emailInvalid'),
    }),
  );
  protected readonly passwordError = computed(() => {
    const c = this.form.controls.password;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return this.i18n.t('auth.register.passwordRequired');
    if (c.errors['maxlength'])
      return this.i18n.t('auth.register.passwordMaxLength', { max: PASSWORD_MAX });
    return '';
  });

  protected readonly confirmError = computed(() => {
    const c = this.form.controls.confirmPassword;
    if (!c.touched) return '';
    if (c.errors?.['required']) return this.i18n.t('auth.register.confirmRequired');
    if (this.form.errors?.['passwordsMismatch'] && c.value)
      return this.i18n.t('auth.register.passwordMismatch');
    return '';
  });

  protected submit(): void {
    this.formError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const pwdErrors = this.form.controls.password.errors ?? {};
      const blockedByPolicy = pwdErrors['minlength'] || pwdErrors['passwordComplexity'];
      if (blockedByPolicy) {
        this.formError.set(this.i18n.t('auth.register.policyBlocked'));
      }
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.auth.register({ email, password }).subscribe({
      next: () => {
        void this.router.navigateByUrl('/workspace');
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          if (err.status === 409) {
            this.formError.set(this.i18n.t('auth.register.emailAlreadyRegistered'));
            return;
          }
          if (err.status === 422) {
            const detail = (err.error as { detail?: string } | null)?.detail;
            this.formError.set(
              typeof detail === 'string' ? detail : this.i18n.t('auth.register.invalidInput'),
            );
            return;
          }
        }
      },
    });
  }
}

function fieldError(control: AbstractControl, messages: Record<string, string>): string {
  if (!control.touched || !control.errors) return '';
  for (const key of Object.keys(control.errors)) {
    if (messages[key]) return messages[key];
  }
  return '';
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const a = group.get('password')?.value;
  const b = group.get('confirmPassword')?.value;
  if (!a || !b) return null;
  return a === b ? null : { passwordsMismatch: true };
}

function passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value || '';
  if (!v) return null; // `required` handles emptiness
  const ok = /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
  return ok ? null : { passwordComplexity: true };
}
