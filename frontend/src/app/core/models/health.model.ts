export interface HealthStatus {
  status: 'ok' | string;
  service: string;
  version: string;
  environment: string;
}

export interface ReadinessStatus {
  status: 'ready' | string;
  database: 'up' | 'unexpected' | string;
}
