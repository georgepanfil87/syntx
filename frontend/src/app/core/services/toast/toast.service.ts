import { Injectable, signal } from '@angular/core';

export type ToastLevel = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  level: ToastLevel;
  title: string;
  detail?: string;
  durationMs: number;
}

interface ToastInput {
  detail?: string;
  durationMs?: number;
}

const DEFAULT_DURATION_MS: Record<ToastLevel, number> = {
  info: 5000,
  success: 5000,
  error: 8000,
};

let toastUid = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  push(level: ToastLevel, title: string, opts: ToastInput = {}): number {
    const id = ++toastUid;
    const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS[level];
    const toast: Toast = { id, level, title, detail: opts.detail, durationMs };
    this._toasts.update((list) => [...list, toast]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  info(title: string, opts: ToastInput = {}): number {
    return this.push('info', title, opts);
  }
  success(title: string, opts: ToastInput = {}): number {
    return this.push('success', title, opts);
  }
  error(title: string, opts: ToastInput = {}): number {
    return this.push('error', title, opts);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
