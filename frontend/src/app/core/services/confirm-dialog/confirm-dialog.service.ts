import { Injectable, signal } from '@angular/core';


export interface ConfirmAsk {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingDialog extends ConfirmAsk {
  resolve: (accepted: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _state = signal<PendingDialog | null>(null);
  readonly state = this._state.asReadonly();

  ask(req: ConfirmAsk): Promise<boolean> {
    const previous = this._state();
    if (previous) previous.resolve(false);

    return new Promise<boolean>((resolve) => {
      this._state.set({ ...req, resolve });
    });
  }

  accept(): void {
    const cur = this._state();
    if (!cur) return;
    this._state.set(null);
    cur.resolve(true);
  }

  cancel(): void {
    const cur = this._state();
    if (!cur) return;
    this._state.set(null);
    cur.resolve(false);
  }
}
