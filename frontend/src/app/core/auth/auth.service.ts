import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthResponse, AuthUser } from './auth.models';

const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';
const USER_KEY = 'auth.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(
    this.readStoredUser()
  );
  readonly user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  get apiEnabled(): boolean {
    return Boolean(environment.apiBaseUrl);
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get user(): AuthUser | null {
    return this.userSubject.value;
  }

  get isLoggedIn(): boolean {
    return Boolean(this.accessToken && this.user);
  }

  get isTeacher(): boolean {
    return this.user?.role === 'teacher' || this.user?.role === 'admin';
  }

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  /**
   * Google idToken (production) or "dev:email:Name" when environment.devAuthBypass.
   */
  loginWithIdToken(idToken: string): Observable<AuthUser> {
    if (!this.apiEnabled) {
      return throwError(() => new Error('API no configurada (apiBaseUrl vacío)'));
    }
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/google`, { idToken })
      .pipe(
        tap((res) => this.persistSession(res)),
        map((res) => res.user)
      );
  }

  /** Local-only helper for DEV_AUTH_BYPASS backend. */
  loginDev(email: string, name?: string): Observable<AuthUser> {
    const token = name?.trim()
      ? `dev:${email.trim()}:${name.trim()}`
      : `dev:${email.trim()}`;
    return this.loginWithIdToken(token);
  }

  refreshMe(): Observable<AuthUser | null> {
    if (!this.accessToken || !this.apiEnabled) {
      return of(null);
    }
    return this.http
      .get<{ user: AuthUser }>(`${environment.apiBaseUrl}/me`)
      .pipe(
        tap((res) => {
          this.userSubject.next(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        }),
        map((res) => res.user),
        catchError(() => {
          this.logout();
          return of(null);
        })
      );
  }

  upgradeToTeacher(): Observable<AuthUser> {
    return this.http
      .post<{ user: AuthUser; accessToken?: string }>(
        `${environment.apiBaseUrl}/upgrade-teacher`,
        {}
      )
      .pipe(
        tap((res) => {
          if (res.accessToken) {
            localStorage.setItem(ACCESS_KEY, res.accessToken);
          }
          this.userSubject.next(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        }),
        map((res) => res.user)
      );
  }

  logout(): void {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (this.apiEnabled && this.accessToken) {
      this.http
        .post(`${environment.apiBaseUrl}/auth/logout`, {
          refreshToken: refresh,
        })
        .subscribe({ error: () => undefined });
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
  }

  private persistSession(res: AuthResponse): void {
    localStorage.setItem(ACCESS_KEY, res.accessToken);
    if (res.refreshToken) {
      localStorage.setItem(REFRESH_KEY, res.refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.userSubject.next(res.user);
  }

  private readStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
