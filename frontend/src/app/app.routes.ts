import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/guest/guest-guard';
import { authGuard } from './core/guards/auth/auth-guard';

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
   {
    path: 'workspace',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workspace/pages/layout/layout').then(
        (m) => m.Layout,
      ),
    children: [
     {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/workspace/pages/dashboard/dashboard').then(
            (m) => m.Dashboard,
          ),
      },
    ],
  },
];
