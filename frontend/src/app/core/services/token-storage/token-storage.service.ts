import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'syntx.auth.token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();

  constructor() {
    this._token.set(this.readPersisted());
  }

  read(): string | null {
    return this._token();
  }

  write(token: string): void {
    this._token.set(token);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, token);
    } catch {
    }
  }

  clear(): void {
    this._token.set(null);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }

  private readPersisted(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
