import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ENVIRONMENT } from '../../config/environment';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = ENVIRONMENT.apiBaseUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(params) });
  }

  post<T, B = unknown>(path: string, body?: B, params?: QueryParams): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? null, { params: this.toParams(params) });
  }

  put<T, B = unknown>(path: string, body?: B, params?: QueryParams): Observable<T> {
    return this.http.put<T>(this.url(path), body ?? null, { params: this.toParams(params) });
  }

  patch<T, B = unknown>(path: string, body?: B, params?: QueryParams): Observable<T> {
    return this.http.patch<T>(this.url(path), body ?? null, { params: this.toParams(params) });
  }

  delete<T = void>(path: string, params?: QueryParams): Observable<T> {
    return this.http.delete<T>(this.url(path), { params: this.toParams(params) });
  }

  url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;
    let out = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      out = out.set(k, String(v));
    }
    return out;
  }
}
