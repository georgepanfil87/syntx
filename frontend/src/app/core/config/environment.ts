export interface SyntxEnvironment {
  readonly apiBaseUrl: string;
  readonly serverBaseUrl: string;
  readonly production: boolean;
}

// `apiBaseUrl` is relative so the dev proxy can forward `/api/*` to
// the backend; `serverBaseUrl` is empty because `/health` and
// `/ready` sit beside `/api/v1`, not under it.
export const ENVIRONMENT: SyntxEnvironment = {
  apiBaseUrl: '/api/v1',
  serverBaseUrl: '',
  production: false,
};
