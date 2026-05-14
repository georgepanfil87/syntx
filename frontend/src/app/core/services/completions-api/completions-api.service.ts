import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CompletionRequest,
  CompletionResponse,
} from '../../models/completion.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CompletionsApiService {
  private readonly api = inject(ApiService);

  complete(req: CompletionRequest): Observable<CompletionResponse> {
    return this.api.post<CompletionResponse, CompletionRequest>(
      '/ai/complete',
      req,
    );
  }
}
