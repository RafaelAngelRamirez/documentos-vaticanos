import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface ThemeStep {
  id?: string;
  order: number;
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  userComment?: string | null;
}

export interface Theme {
  id: string;
  title: string;
  description?: string | null;
  coverImageKey?: string | null;
  visibility: string;
  steps: ThemeStep[];
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
    input: Partial<{ title: string; description: string; coverImageKey: string }>
  ): Observable<Theme> {
    return this.http
      .patch<{ item: Theme }>(`${environment.apiBaseUrl}/me/themes/${id}`, input)
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
}
