import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

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

@Injectable({ providedIn: 'root' })
export class ThemesService {
  constructor(private http: HttpClient) {}

  list(): Observable<Theme[]> {
    return this.http
      .get<{ items: Theme[] }>(`${environment.apiBaseUrl}/me/themes`)
      .pipe(map((r) => r.items));
  }

  get(id: string): Observable<Theme> {
    return this.http
      .get<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes/${id}`)
      .pipe(map((r) => r.item));
  }

  create(input: {
    title: string;
    description?: string;
  }): Observable<Theme> {
    return this.http
      .post<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes`, input)
      .pipe(map((r) => r.item));
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
    return this.http
      .patch<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes/${id}`, input)
      .pipe(map((r) => r.item));
  }

  submit(id: string): Observable<Theme> {
    return this.http
      .post<{ item: Theme }>(
        `${environment.apiBaseUrl}/me/themes/${id}/submit`,
        {}
      )
      .pipe(map((r) => r.item));
  }

  makePrivate(id: string): Observable<Theme> {
    return this.http
      .post<{ item: Theme }>(
        `${environment.apiBaseUrl}/me/themes/${id}/make-private`,
        {}
      )
      .pipe(map((r) => r.item));
  }

  download(id: string): Observable<Theme> {
    return this.http
      .post<{ item: Theme }>(
        `${environment.apiBaseUrl}/me/themes/${id}/download`,
        {}
      )
      .pipe(map((r) => r.item));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete(`${environment.apiBaseUrl}/me/themes/${id}`)
      .pipe(map(() => undefined));
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
    return this.http
      .put<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes/${id}/steps`, {
        steps,
      })
      .pipe(map((r) => r.item));
  }

  // ── Admin ────────────────────────────────────────────────────────────

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
