import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../services/toast/toast.service';
import { TokenStorageService } from '../../services/token-storage/token-storage.service';

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const tokens = inject(TokenStorageService);
  const toasts = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => req.url.includes(p));

        if (err.status === 401 && !isPublicAuth) {
          tokens.clear();
          const next = encodeURIComponent(router.url || '/');
          if (!router.url.startsWith('/login')) {
            void router.navigateByUrl(`/login?next=${next}`);
            toasts.info('Session expired', { detail: 'Please sign in again.' });
          }
        } else if (err.status === 0) {
          toasts.error('Cannot reach the server', {
            detail: 'Check that the backend is running.',
          });
        } else if (err.status >= 500) {
          toasts.error(`Server error (HTTP ${err.status})`, {
            detail: errorDetail(err) ?? `${req.method} ${req.url}`,
          });
        }
      }
      return throwError(() => err);
    }),
  );
};

function errorDetail(err: HttpErrorResponse): string | undefined {
  const body = err.error as { detail?: string } | string | null;
  if (typeof body === 'string') return body;
  if (body && typeof body.detail === 'string') return body.detail;
  return undefined;
}
