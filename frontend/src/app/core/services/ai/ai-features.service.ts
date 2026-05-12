import { Injectable, inject, signal } from '@angular/core';
import { AiFeatures } from '../../models/ai.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class AiFeaturesService {
  private readonly api = inject(ApiService);
  private readonly _data = signal<AiFeatures | null>(null);
  private readonly _loading = signal<boolean>(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();

  loadOnce(): void {
    if (this._data() || this._loading()) return;
    this._loading.set(true);
    this.api.get<AiFeatures>('/ai/features').subscribe({
      next: (res) => {
        this._data.set(res);
        this._loading.set(false);
      },
      error: () => {
        // Fall back to "all features off" — UI hides toggles whose
        // server flag is false anyway.
        this._data.set({ web_search_enabled: false });
        this._loading.set(false);
      },
    });
  }
}
