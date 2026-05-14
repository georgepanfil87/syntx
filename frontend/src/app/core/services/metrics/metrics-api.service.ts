import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MetricsResponse } from '../../models/metrics.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class MetricsApi {
  private readonly api = inject(ApiService);

  snapshot(limit: number = 200): Observable<MetricsResponse> {
    return this.api.get<MetricsResponse>('/admin/metrics', { limit });
  }
}
