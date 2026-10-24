import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from '../auth/auth.service';

export type ThemeReviewStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'changes'
  | 'rejected';

export interface ThemeStep {
  id?: string;
  order: number;
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  userComment?: string | null;
  /** ISO string · última modificación del paso (necesario para el merge F9) */
  updatedAt?: string;
}

export interface ThemeOwner {
  id: string;
  name: string;
  email: string;
}

export interface Theme {
  id: string;
  title: string;
  description?: string | null;
  coverImageKey?: string | null;
  visibility: string;
  /** none | pending | approved | changes | rejected */
  reviewStatus?: ThemeReviewStatus | string;
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  downloads?: number;
  steps: ThemeStep[];
  owner?: ThemeOwner;
  createdAt?: string;
  updatedAt?: string;
}

/** Clave de persistencia local de los temas del usuario. */
const THEMES_STORAGE_KEY = 'themes.user';

/**
 * Temas de usuario offline-first (F8b).
 *
 * - Persistencia primaria en localStorage: crear/editar/borrar temas y pasos
 *   funciona completamente sin sesión.
 * - Sincronización HTTP solo si hay sesión, best-effort con catch silencioso.
 * - Las operaciones de administración siguen siendo solo HTTP.
 */
@Injectable({ providedIn: 'root' })
export class ThemesService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  // ── Persistencia local (fuente primaria) ─────────────────────────────

  private readLocal(): Theme[] {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(THEMES_STORAGE_KEY)
          : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return this.migrate(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  }

  private writeLocal(items: Theme[]): void {
    try {
      localStorage.setItem(THEMES_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* almacenamiento no disponible: silencioso */
    }
  }

  /**
   * Migración al cargar: añade `updatedAt` (ISO) por tema y por paso si no
   * existe, reutilizando `createdAt` cuando está disponible.
   */
  private migrate(items: Theme[]): Theme[] {
    let changed = false;
    const now = new Date().toISOString();
    const out = items.map((t) => {
      const themeUpdated = t.updatedAt || t.createdAt || now;
      if (!t.updatedAt) changed = true;
      const steps = (t.steps || []).map((s) => {
        if (s.updatedAt) return s;
        changed = true;
        return { ...s, updatedAt: themeUpdated };
      });
      return { ...t, updatedAt: themeUpdated, steps };
    });
    if (changed) this.writeLocal(out);
    return out;
  }

  private saveTheme(theme: Theme): void {
    const items = this.readLocal();
    const idx = items.findIndex((t) => t.id === theme.id);
    if (idx >= 0) items[idx] = theme;
    else items.push(theme);
    this.writeLocal(items);
  }

  private newId(): string {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
      }
    } catch {
      /* sin crypto: usar fallback */
    }
    return (
      'local-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  // ── Sincronización best-effort (solo con sesión) ─────────────────────

  private get canSync(): boolean {
    return Boolean(environment.apiBaseUrl) && this.auth.isLoggedIn;
  }

  /** Lanza la petición y descarta cualquier error (catch silencioso). */
  private trySync(req: Observable<unknown>): void {
    if (!this.canSync) return;
    req.subscribe({ next: () => undefined, error: () => undefined });
  }

  /** Incorpora temas del servidor al almacén local (gana el más reciente). */
  private mergeFromServer(serverItems: Theme[]): void {
    try {
      const byId = new Map(this.readLocal().map((t) => [t.id, t]));
      let changed = false;
      for (const s of serverItems || []) {
        const mine = byId.get(s.id);
        if (!mine) {
          byId.set(s.id, s);
          changed = true;
          continue;
        }
        const sTime = Date.parse(s.updatedAt || '') || 0;
        const lTime = Date.parse(mine.updatedAt || '') || 0;
        if (sTime > lTime) {
          byId.set(s.id, s);
          changed = true;
        }
      }
      if (changed) this.writeLocal(this.migrate([...byId.values()]));
    } catch {
      /* silencioso */
    }
  }

  // ── API de usuario (offline-first) ───────────────────────────────────

  list(): Observable<Theme[]> {
    if (this.canSync) {
      this.http
        .get<{ items: Theme[] }>(`${environment.apiBaseUrl}/me/themes`)
        .subscribe({
          next: (r) => this.mergeFromServer(r?.items || []),
          error: () => undefined,
        });
    }
    return of(this.readLocal());
  }

  get(id: string): Observable<Theme> {
    const local = this.readLocal().find((t) => t.id === id);
    if (local) return of(local);
    if (this.canSync) {
      return this.http
        .get<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes/${id}`)
        .pipe(
          map((r) => r.item),
          tap((t) => this.saveTheme(this.migrate([t])[0]))
        );
    }
    return throwError(() => new Error('Tema no encontrado'));
  }

  create(input: {
    title: string;
    description?: string;
  }): Observable<Theme> {
    const now = new Date().toISOString();
    const theme: Theme = {
      id: this.newId(),
      title: input.title,
      description: input.description ?? null,
      visibility: 'private',
      reviewStatus: 'none',
      steps: [],
      createdAt: now,
      updatedAt: now,
    };
    this.saveTheme(theme);
    this.trySync(
      this.http.post(`${environment.apiBaseUrl}/me/themes`, input)
    );
    return of(theme);
  }

  update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      coverImageKey: string;
      visibility: string;
    }>
  ): Observable<Theme> {
    const local = this.readLocal().find((t) => t.id === id);
    if (!local) return throwError(() => new Error('Tema no encontrado'));
    const updated: Theme = {
      ...local,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.saveTheme(updated);
    this.trySync(
      this.http.patch(`${environment.apiBaseUrl}/me/themes/${id}`, input)
    );
    return of(updated);
  }

  submit(id: string): Observable<Theme> {
    const local = this.readLocal().find((t) => t.id === id);
    if (!local) return throwError(() => new Error('Tema no encontrado'));
    const now = new Date().toISOString();
    const updated: Theme = {
      ...local,
      reviewStatus: 'pending',
      submittedAt: now,
      updatedAt: now,
    };
    this.saveTheme(updated);
    this.trySync(
      this.http.post(`${environment.apiBaseUrl}/me/themes/${id}/submit`, {})
    );
    return of(updated);
  }

  makePrivate(id: string): Observable<Theme> {
    const local = this.readLocal().find((t) => t.id === id);
    if (!local) return throwError(() => new Error('Tema no encontrado'));
    const updated: Theme = {
      ...local,
      visibility: 'private',
      reviewStatus: 'none',
      submittedAt: null,
      updatedAt: new Date().toISOString(),
    };
    this.saveTheme(updated);
    this.trySync(
      this.http.post(
        `${environment.apiBaseUrl}/me/themes/${id}/make-private`,
        {}
      )
    );
    return of(updated);
  }

  download(id: string): Observable<Theme> {
    if (this.canSync) {
      return this.http
        .post<{ item: Theme }>(
          `${environment.apiBaseUrl}/me/themes/${id}/download`,
          {}
        )
        .pipe(
          map((r) => r.item),
          tap((t) => this.saveTheme(this.migrate([t])[0]))
        );
    }
    const local = this.readLocal().find((t) => t.id === id);
    if (local) return of(local);
    return throwError(() => new Error('Tema no encontrado'));
  }

  remove(id: string): Observable<void> {
    this.writeLocal(this.readLocal().filter((t) => t.id !== id));
    this.trySync(this.http.delete(`${environment.apiBaseUrl}/me/themes/${id}`));
    return of(undefined);
  }

  setSteps(
    id: string,
    steps: Array<{
      documentId: string;
      unitIndex: number;
      unitLabel?: string;
      userComment?: string;
    }>
  ): Observable<Theme> {
    const local = this.readLocal().find((t) => t.id === id);
    if (!local) return throwError(() => new Error('Tema no encontrado'));
    const now = new Date().toISOString();
    // Conserva id/updatedAt de pasos sin cambios (identidad por contenido).
    const previous = [...(local.steps || [])];
    const stepKey = (s: {
      documentId: string;
      unitIndex: number;
      unitLabel?: string | null;
      userComment?: string | null;
    }) =>
      [s.documentId, s.unitIndex, s.unitLabel ?? '', s.userComment ?? ''].join(
        ' '
      );
    const nextSteps: ThemeStep[] = steps.map((s, i) => {
      const matchIdx = previous.findIndex((p) => stepKey(p) === stepKey(s));
      const match = matchIdx >= 0 ? previous.splice(matchIdx, 1)[0] : null;
      return {
        id: match?.id,
        order: i,
        documentId: s.documentId,
        unitIndex: s.unitIndex,
        unitLabel: s.unitLabel ?? null,
        userComment: s.userComment ?? null,
        updatedAt: match?.updatedAt || now,
      };
    });
    const updated: Theme = { ...local, steps: nextSteps, updatedAt: now };
    this.saveTheme(updated);
    this.trySync(
      this.http.put(`${environment.apiBaseUrl}/me/themes/${id}/steps`, {
        steps,
      })
    );
    return of(updated);
  }

  // ── Admin (solo HTTP) ────────────────────────────────────────────────

  adminList(status = 'pending'): Observable<{
    items: Theme[];
    counts: Record<string, number>;
  }> {
    const params = new HttpParams().set('status', status);
    return this.http.get<{ items: Theme[]; counts: Record<string, number> }>(
      `${environment.apiBaseUrl}/admin/themes`,
      { params }
    );
  }

  adminGet(id: string): Observable<Theme> {
    return this.http
      .get<{ item: Theme }>(`${environment.apiBaseUrl}/admin/themes/${id}`)
      .pipe(map((r) => r.item));
  }

  adminReview(
    id: string,
    decision: 'approved' | 'changes' | 'rejected',
    note?: string
  ): Observable<Theme> {
    return this.http
      .post<{ item: Theme }>(
        `${environment.apiBaseUrl}/admin/themes/${id}/review`,
        { decision, note }
      )
      .pipe(map((r) => r.item));
  }
}
