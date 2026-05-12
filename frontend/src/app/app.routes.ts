import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/pages/landing-page/landing-page').then(m => m.LandingPage)
  }
];
