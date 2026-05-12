import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error/error-interceptor';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { chatFeature, ChatEffects } from './core/state/chat';
import { filesFeature, FilesEffects } from './core/state/files';
import { projectsFeature, ProjectsEffects } from './core/state/projects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideStore({
      [projectsFeature.name]: projectsFeature.reducer,
      [filesFeature.name]: filesFeature.reducer,
      [chatFeature.name]: chatFeature.reducer,
    }),
    provideEffects([ProjectsEffects, FilesEffects, ChatEffects]),
    provideStoreDevtools({
      maxAge: 50,
      autoPause: true,
      logOnly: !isDevMode(),
      connectInZone: true,
    }),
  ],
};
