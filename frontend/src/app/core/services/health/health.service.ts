import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HealthStatus, ReadinessStatus } from '../../models/health.model';
import { ENVIRONMENT } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly base = ENVIRONMENT.serverBaseUrl;

  liveness(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.base}/health`);
  }

  readiness(): Observable<ReadinessStatus> {
    return this.http.get<ReadinessStatus>(`${this.base}/ready`);
  }
}
