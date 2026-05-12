import { Injectable, inject, signal } from '@angular/core';
import { ModelsResponse } from '../../models/ai.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class ModelsService {
  private readonly api = inject(ApiService);
  private readonly _data = signal<ModelsResponse | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadOnce(): void {
    if (this._data() || this._loading()) return;
    this.reload();
  }

  reload(): void {
    if (this._loading()) return;
    this._loading.set(true);
    this._error.set(null);
    this.api.get<ModelsResponse>('/ai/models').subscribe({
      next: (res) => {
        this._data.set(res);
        this._loading.set(false);
      },
      error: () => {
        // Ollama might be down — surface a generic message; the
        // settings page degrades to a free-text input either way.
        this._error.set('Could not reach Ollama.');
        this._loading.set(false);
      },
    });
  }
}
