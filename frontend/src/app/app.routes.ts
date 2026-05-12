import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/guest/guest-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/pages/landing-page/landing-page').then(m => m.LandingPage)
  },
   {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register').then((m) => m.Register),
  },
];
