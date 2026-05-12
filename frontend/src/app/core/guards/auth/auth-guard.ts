import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TokenStorageService } from '../../services/token-storage/token-storage.service';

export const authGuard: CanActivateFn = (_route, state): true | UrlTree => {
  const router = inject(Router);
  const tokens = inject(TokenStorageService);

  if (tokens.read()) return true;

  const next = encodeURIComponent(state.url || '/');
  return router.parseUrl(`/login?next=${next}`);
};
