import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TokenStorageService } from '../../services/token-storage/token-storage.service';

export const guestGuard: CanActivateFn = (): true | UrlTree => {
  const router = inject(Router);
  const tokens = inject(TokenStorageService);
  return tokens.read() ? router.parseUrl('/workspace') : true;
};
