import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface PersonalReference {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  note?: string | null;
  tags?: string[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReferencesService {
  constructor(private http: HttpClient) {}

  list(): Observable<PersonalReference[]> {
    return this.http
      .get<{ items: PersonalReference[] }>(
        `${environment.apiBaseUrl}/me/references`
      )
      .pipe(map((r) => r.items));
  }

  save(input: {
    documentId: string;
    unitIndex: number;
    unitLabel?: string;
    note?: string;
  }): Observable<PersonalReference> {
    return this.http
      .post<{ item: PersonalReference }>(
        `${environment.apiBaseUrl}/me/references`,
        input
      )
      .pipe(map((r) => r.item));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<{ ok: boolean }>(`${environment.apiBaseUrl}/me/references/${id}`)
      .pipe(map(() => undefined));
  }
}
