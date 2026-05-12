import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../../services/token-storage/token-storage.service';


const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorageService);
  const token = tokens.read();
  if (!token) return next(req);

  if (/^https?:\/\//i.test(req.url) && !sameOrigin(req.url)) {
    return next(req);
  }

  if (PUBLIC_AUTH_PATHS.some((p) => req.url.includes(p))) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};

function sameOrigin(url: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return true;
  }
}
