import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Logo, Button, Icon, InputComponent, Badge } from '../../../../shared/ui';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'sx-login',
  imports: [
    Logo,
    Button,
    Icon,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    InputComponent,
    Badge,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly formError = signal<string>('');

  protected readonly year = new Date().getFullYear();

  protected emailError(): string {
    const c = this.form.controls.email;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return this.i18n.t('auth.login.emailRequired');
    if (c.errors['email']) return this.i18n.t('auth.login.emailInvalid');
    return '';
  }

  protected passwordError(): string {
    const c = this.form.controls.password;
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return this.i18n.t('auth.login.passwordRequired');
    return '';
  }

  protected submit(): void {
    this.formError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email, password }).subscribe({
      next: () => {
        const next = this.route.snapshot.queryParamMap.get('next');
        const target = next ? decodeURIComponent(next) : '/workspace';
        void this.router.navigateByUrl(target);
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.formError.set(this.i18n.t('auth.login.invalidCreds'));
          return;
        }
      },
    });
  }
}
