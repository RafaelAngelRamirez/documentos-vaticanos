import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import {
  decodeShelfPackage,
  type ShelfPackage,
} from './shelf-search.logic';

export const SHELF_PACKAGE_ROOT = 'assets/corpus/search/packages';

export interface ShelfPackageEntry {
  id: string;
  file: string;
  docs?: number;
  terms?: number;
  rawBytes?: number;
}

export interface ShelfPackageManifest {
  version: number;
  locale: string;
  packages: ShelfPackageEntry[];
}

/**
 * Carga los índices compactos que haya en el aparato.
 * Un paquete que no está no se pide por red: el 404 deja la columna vacía.
 */
@Injectable({
  providedIn: 'root',
})
export class ShelfIndexService {
  private locale = '';
  private manifest$: Observable<ShelfPackageManifest | null> | null = null;
  private readonly decoded = new Map<string, ShelfPackage>();
  private readonly inflight = new Map<string, Observable<ShelfPackage | null>>();

  constructor(private readonly http: HttpClient) {}

  manifest(locale: string): Observable<ShelfPackageManifest | null> {
    const loc = (locale || 'es').trim().toLowerCase().split(/[-_]/)[0] || 'es';
    if (this.locale !== loc) {
      this.locale = loc;
      this.manifest$ = null;
    }
    if (!this.manifest$) {
      this.manifest$ = this.http
        .get<ShelfPackageManifest>(`${SHELF_PACKAGE_ROOT}/${loc}.json`)
        .pipe(
          catchError(() => of(null)),
          shareReplay(1),
        );
    }
    return this.manifest$;
  }

  load(
    locale: string,
    packageId: string,
    file: string,
  ): Observable<ShelfPackage | null> {
    const loc = (locale || 'es').trim().toLowerCase().split(/[-_]/)[0] || 'es';
    const key = `${loc}:${packageId}`;
    const cached = this.decoded.get(key);
    if (cached) return of(cached);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const req = this.http
      .get(`${SHELF_PACKAGE_ROOT}/${file}`, { responseType: 'arraybuffer' })
      .pipe(
        map((buf) => {
          const pkg = decodeShelfPackage(new Uint8Array(buf));
          this.decoded.set(key, pkg);
          return pkg;
        }),
        catchError(() => of(null)),
        shareReplay(1),
      );
    this.inflight.set(key, req);
    return req;
  }
}
