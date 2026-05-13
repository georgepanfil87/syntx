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
       {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/pages/projects-list/projects-list').then(
            (m) => m.ProjectsList,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings-page/settings-page').then(
            (m) => m.SettingsPage,
          ),
      },
    ],
  },
   {
    path: 'workspace/projects/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/workspace/pages/project-workspace/project-workspace'
      ).then((m) => m.ProjectWorkspace),
  },
  { path: '**', redirectTo: '' },
];
