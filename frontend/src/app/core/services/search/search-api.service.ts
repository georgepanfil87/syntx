import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';


export type SearchMode = 'keyword' | 'semantic';

export interface SearchHit {
  path: string;
  snippet: string;
  score: number;
  start_line: number;
  end_line: number;
}

export interface SearchRequest {
  query: string;
  mode?: SearchMode;
  limit?: number;
}

export interface SearchResponse {
  items: SearchHit[];
  mode: SearchMode;
  query: string;
}

@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly api = inject(ApiService);

  search(projectId: string, body: SearchRequest): Observable<SearchResponse> {
    return this.api.post<SearchResponse, SearchRequest>(
      `/projects/${projectId}/search`,
      body,
    );
  }
}
