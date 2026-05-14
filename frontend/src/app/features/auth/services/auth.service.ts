import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { LoginRequest, TokenResponse, RegisterRequest } from '../../../core/models/auth.model';
import { UserRead } from '../../../core/models/user.model';
import { ApiService } from '../../../core/services/api/api.service';
import { TokenStorageService } from '../../../core/services/token-storage/token-storage.service';



@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly _currentUser = signal<UserRead | null>(null);
  private readonly _loading = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly loading = this._loading.asReadonly();


  readonly isAuthenticated = computed(
    () => this.tokens.token() !== null && this._currentUser() !== null,
  );

  login(req: LoginRequest): Observable<UserRead> {
    this._loading.set(true);
    return this.api.post<TokenResponse, LoginRequest>('/auth/login', req).pipe(
      tap((res) => this.tokens.write(res.access_token)),
      switchMap(() => this.fetchMe()),
      finalize(() => this._loading.set(false)),
    );
  }


  register(req: RegisterRequest): Observable<UserRead> {
    this._loading.set(true);
    return this.api.post<UserRead, RegisterRequest>('/auth/register', req).pipe(
      switchMap(() => this.login({ email: req.email, password: req.password })),
      finalize(() => this._loading.set(false)),
    );
  }

  logout(): void {
    this.tokens.clear();
    this._currentUser.set(null);
    void this.router.navigateByUrl('/login');
  }


  bootstrap(): Observable<UserRead | null> {
    if (!this.tokens.read()) return of(null);
    return this.fetchMe().pipe(
      catchError(() => {
        this._currentUser.set(null);
        return of(null);
      }),
    );
  }

  private fetchMe(): Observable<UserRead> {
    return this.api.get<UserRead>('/users/me').pipe(
      tap((user) => this._currentUser.set(user)),
    );
  }
}
