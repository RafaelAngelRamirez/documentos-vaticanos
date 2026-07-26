import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { CorpusService } from '../core/corpus/corpus.service';
import { SantoralService } from '../core/santoral/santoral.service';
import {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
  Referencia,
} from '../core/corpus/corpus.models';
import {
  DEFAULT_BODY_LOAD_CONCURRENCY,
  DEFAULT_INDEX_LOAD_CONCURRENCY,
  DEFAULT_RELATED_HUB_CAP,
  mapPool,
  metasForSearchLocale,
  pickRelatedHubMetas,
} from '../core/search/search-load.logic';

// Re-export models so existing imports keep working.
export type {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
  Referencia,
};

export interface EnsureLoadedManyOptions {
  /** Max concurrent ensureLoaded calls (default 6). */
  concurrency?: number;
  /** When true, abort scheduling further loads (stale query gen). */
  isCancelled?: () => boolean;
  /**
   * When true (default), failed individual docs are skipped instead of
   * failing the whole batch.
   */
  softFail?: boolean;
}

/**
 * Thin facade over {@link CorpusService} to minimize consumer churn.
 * Documents are no longer statically imported; they load via HTTP on demand.
 * Also serves synthetic saint biographies (`santoral:{id}`) for the lector.
 */
@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  /**
   * Populated after progressive / individual loads.
   * Prefer async APIs for new code. Not a full-corpus guarantee.
   */
  documentos_disponibles: IndiceDocumentos[] = [];

  constructor(
    private readonly corpus: CorpusService,
    private readonly santoral: SantoralService,
  ) {}

  loadManifest(): Observable<DocumentMeta[]> {
    return this.corpus.loadManifest();
  }

  listDocuments(): DocumentMeta[] {
    return this.corpus.listDocuments();
  }

  ensureLoaded(documentId: string): Observable<IndiceDocumentos> {
    // Saint biographies use the same lector path with namespaced documentId.
    if (this.santoral.isReadingDocumentId(documentId)) {
      return this.santoral.ensureSaintAsIndice(documentId).pipe(
        tap((doc) => this.upsertDisponible(doc)),
      );
    }
    return this.corpus.ensureLoaded(documentId).pipe(
      map((loaded) => this.corpus.toIndiceDocumentos(loaded)),
      tap((doc) => this.upsertDisponible(doc))
    );
  }

  /**
   * Index-only load (PR2b). Saints fall back to full ensureLoaded (no separate index).
   */
  ensureIndex(documentId: string): Observable<IndiceDocumentos> {
    if (this.santoral.isReadingDocumentId(documentId)) {
      return this.ensureLoaded(documentId);
    }
    return this.corpus.ensureIndex(documentId).pipe(
      map((indexed) => this.corpus.toIndiceFromIndex(indexed)),
      tap((doc) => this.upsertDisponible(doc)),
    );
  }

  /**
   * Load many inverted indexes with concurrency pool (PR2b ranking path).
   */
  ensureIndexMany(
    documentIds: string[],
    options: EnsureLoadedManyOptions = {},
  ): Observable<IndiceDocumentos[]> {
    const ids = [...new Set(documentIds.filter(Boolean))];
    if (!ids.length) return of([]);
    const concurrency =
      options.concurrency ?? DEFAULT_INDEX_LOAD_CONCURRENCY;
    const soft = options.softFail !== false;
    const isCancelled = options.isCancelled;

    return from(
      mapPool(
        ids,
        concurrency,
        async (id) => {
          if (isCancelled?.()) return null;
          try {
            return await new Promise<IndiceDocumentos>((resolve, reject) => {
              this.ensureIndex(id).subscribe({
                next: resolve,
                error: reject,
              });
            });
          } catch (err) {
            if (soft) {
              console.warn(`ensureIndexMany soft-fail ${id}`, err);
              return null;
            }
            throw err;
          }
        },
        isCancelled,
      ),
    ).pipe(
      map((rows) => rows.filter((d): d is IndiceDocumentos => d != null)),
    );
  }

  /**
   * Locale-scoped index-only load for general search ranking (PR2b).
   * Does not fetch content.json; use ensureLoadedMany for snippet docs.
   */
  ensureIndexForLocale(
    contentLocale: string,
    opts: EnsureLoadedManyOptions & { allLocales?: boolean } = {},
  ): Observable<IndiceDocumentos[]> {
    return this.corpus.loadManifest().pipe(
      switchMap((metas) => {
        const scoped = metasForSearchLocale(
          metas,
          contentLocale,
          opts.allLocales === true,
        );
        return this.ensureIndexMany(
          scoped.map((m) => m.id),
          {
            ...opts,
            concurrency:
              opts.concurrency ?? DEFAULT_INDEX_LOAD_CONCURRENCY,
          },
        );
      }),
    );
  }

  /**
   * Load many document ids with a concurrency pool (PR2a progressive search).
   * Prefer this over {@link ensureAllLoaded}. Soft-fails per doc by default.
   */
  ensureLoadedMany(
    documentIds: string[],
    options: EnsureLoadedManyOptions = {},
  ): Observable<IndiceDocumentos[]> {
    const ids = [...new Set(documentIds.filter(Boolean))];
    if (!ids.length) return of([]);
    const concurrency = options.concurrency ?? DEFAULT_BODY_LOAD_CONCURRENCY;
    const soft = options.softFail !== false;
    const isCancelled = options.isCancelled;

    return from(
      mapPool(
        ids,
        concurrency,
        async (id) => {
          if (isCancelled?.()) return null;
          try {
            return await new Promise<IndiceDocumentos>((resolve, reject) => {
              this.ensureLoaded(id).subscribe({
                next: resolve,
                error: reject,
              });
            });
          } catch (err) {
            if (soft) {
              console.warn(`ensureLoadedMany soft-fail ${id}`, err);
              return null;
            }
            throw err;
          }
        },
        isCancelled,
      ),
    ).pipe(
      map((rows) =>
        rows.filter((d): d is IndiceDocumentos => d != null),
      ),
    );
  }

  /**
   * Locale-scoped full body load (legacy PR2a debt path).
   * Prefer {@link ensureIndexForLocale} + ensureLoadedMany(top-N) for search.
   * Does **not** load the full multi-locale pack.
   */
  ensureLoadedForLocale(
    contentLocale: string,
    opts: EnsureLoadedManyOptions & { allLocales?: boolean } = {},
  ): Observable<IndiceDocumentos[]> {
    return this.corpus.loadManifest().pipe(
      switchMap((metas) => {
        const scoped = metasForSearchLocale(
          metas,
          contentLocale,
          opts.allLocales === true,
        );
        return this.ensureLoadedMany(
          scoped.map((m) => m.id),
          opts,
        );
      }),
    );
  }

  /**
   * Bounded hub pool for related citations (PR2a/C.3) — not full locale.
   */
  ensureLoadedRelatedPool(
    contentLocale: string,
    opts: EnsureLoadedManyOptions & {
      allLocales?: boolean;
      hubCap?: number;
      extraIds?: string[];
    } = {},
  ): Observable<IndiceDocumentos[]> {
    return this.corpus.loadManifest().pipe(
      switchMap((metas) => {
        const hubs = pickRelatedHubMetas(
          metas,
          contentLocale,
          opts.hubCap ?? DEFAULT_RELATED_HUB_CAP,
          opts.allLocales === true,
        );
        const ids = [
          ...new Set([
            ...hubs.map((m) => m.id),
            ...(opts.extraIds || []).filter(Boolean),
          ]),
        ];
        return this.ensureLoadedMany(ids, opts);
      }),
    );
  }

  /**
   * @deprecated Prefer {@link ensureLoadedForLocale} / {@link ensureLoadedMany}.
   * Loads **every** manifest document (multi-locale OOM risk on device).
   * Kept only for emergency / tests; search UI must not call this.
   */
  ensureAllLoaded(): Observable<IndiceDocumentos[]> {
    return this.corpus.loadManifest().pipe(
      switchMap((metas) => {
        if (!metas.length) {
          this.documentos_disponibles = [];
          return of([]);
        }
        return this.ensureLoadedMany(
          metas.map((m) => m.id),
          { concurrency: DEFAULT_BODY_LOAD_CONCURRENCY },
        ).pipe(
          tap((docs) => {
            this.documentos_disponibles = docs;
          }),
        );
      }),
    );
  }

  getArticle(
    documentId: string,
    indexOrConsecutivo: number | string
  ): Article | undefined {
    return this.corpus.getArticle(documentId, indexOrConsecutivo);
  }

  private upsertDisponible(doc: IndiceDocumentos): void {
    const key = doc.id ?? doc.nombre;
    const idx = this.documentos_disponibles.findIndex(
      (d) => (d.id ?? d.nombre) === key || d.nombre === doc.nombre
    );
    if (idx >= 0) {
      this.documentos_disponibles[idx] = doc;
    } else {
      this.documentos_disponibles.push(doc);
    }
  }
}
