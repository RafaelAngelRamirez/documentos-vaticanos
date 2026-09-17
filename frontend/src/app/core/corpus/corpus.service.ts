import { HttpClient } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Observable, firstValueFrom, from, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
} from './corpus.models';
import { IndexedDbCorpusStore } from './corpus-durable-idb.store';
import {
  CorpusLoadEngine,
  type IndexedDocument,
} from './corpus-load.logic';
import {
  DocumentFamily,
  editionsForDocument,
  familyKey,
  listPreferredEditions,
  localeLabel as localeLabelPure,
  multiLocaleSubtitle,
  pickPreferredEdition,
} from './document-locale.logic';
import {
  DEFAULT_BODY_LOAD_CONCURRENCY,
  DEFAULT_INDEX_LOAD_CONCURRENCY,
  DEFAULT_RELATED_HUB_CAP,
  mapPool,
  metasForSearchLocale,
  pickRelatedHubMetas,
} from '../search/search-load.logic';
import { PapacyService } from '../papacy/papacy.service';
import { isPopeDocumentId } from '../papacy/papacy-units.logic';
import { SantoralService } from '../santoral/santoral.service';
import { isSaintDocumentId } from '../santoral/santoral-units.logic';

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

@Injectable({
  providedIn: 'root',
})
export class CorpusService {
  private readonly engine: CorpusLoadEngine;

  /** In-flight Observable wrappers so concurrent subscribers share one request. */
  private manifestInflight$: Observable<DocumentMeta[]> | null = null;
  private readonly inflight$ = new Map<string, Observable<LoadedDocument>>();
  private readonly indexInflight$ = new Map<
    string,
    Observable<IndexedDocument>
  >();

  constructor(
    private readonly http: HttpClient,
    durableStore: IndexedDbCorpusStore,
    private readonly injector: Injector
  ) {
    this.engine = new CorpusLoadEngine({
      httpGet: <T>(url: string) => firstValueFrom(this.http.get<T>(url)),
      store: durableStore,
    });
  }

  private saintPack(): SantoralService {
    return this.injector.get(SantoralService);
  }

  private popePack(): PapacyService {
    return this.injector.get(PapacyService);
  }

  /** Drop in-memory only (durable kept). Used by tests simulating reload. */
  clearMemoryCache(): void {
    this.engine.clearMemory();
    this.manifestInflight$ = null;
    this.inflight$.clear();
    this.indexInflight$.clear();
  }

  loadManifest(): Observable<DocumentMeta[]> {
    if (this.engine.hasManifestInMemory()) {
      return of(this.engine.listDocuments());
    }
    if (this.manifestInflight$) {
      return this.manifestInflight$;
    }

    const request$ = from(this.engine.loadManifest()).pipe(shareReplay(1));
    this.manifestInflight$ = request$;
    request$.subscribe({
      complete: () => {
        this.manifestInflight$ = null;
      },
      error: () => {
        this.manifestInflight$ = null;
      },
    });
    return request$;
  }

  listDocuments(): DocumentMeta[] {
    return this.engine.listDocuments() as DocumentMeta[];
  }

  /**
   * Catálogo: una edición por familia de idiomas (preferida del usuario).
   * No altera `listDocuments()` (búsqueda / carga total).
   */
  listCatalogDocuments(preferredLocale: string): DocumentMeta[] {
    return listPreferredEditions(this.listDocuments(), preferredLocale);
  }

  /** Ediciones (LA/ES/…) de la misma obra que `documentId`. */
  editionsOf(documentId: string): DocumentMeta[] {
    return editionsForDocument(this.listDocuments(), documentId);
  }

  /** Familia multi-locale con preferred ya resuelto. */
  familyOf(
    documentId: string,
    preferredLocale: string,
  ): DocumentFamily<DocumentMeta> | null {
    const editions = this.editionsOf(documentId);
    if (!editions.length) return null;
    const self = editions.find((e) => e.id === documentId) ?? editions[0];
    return {
      key: familyKey(self.id, self.locale),
      editions,
      preferred: pickPreferredEdition(editions, preferredLocale),
    };
  }

  multiLocaleLabel(documentId: string): string | null {
    return multiLocaleSubtitle(this.editionsOf(documentId));
  }

  getMeta(documentId: string): DocumentMeta | undefined {
    const fromEngine = this.engine.getMeta(documentId) as
      | DocumentMeta
      | undefined;
    if (fromEngine) return fromEngine;
    if (isSaintDocumentId(documentId)) {
      return this.saintPack().getSaintMeta(documentId);
    }
    if (isPopeDocumentId(documentId)) {
      return this.popePack().getPopeMeta(documentId);
    }
    return undefined;
  }

  /**
   * Resolve meta by stable id or legacy display title used in routes.
   */
  resolveMeta(idOrTitle: string): DocumentMeta | undefined {
    return this.getMeta(idOrTitle);
  }

  ensureLoaded(documentId: string): Observable<LoadedDocument> {
    if (isPopeDocumentId(documentId)) {
      return this.popePack().ensurePopeLoaded(documentId);
    }
    if (isSaintDocumentId(documentId)) {
      return this.saintPack().ensureSaintLoaded(documentId);
    }

    const cached = this.engine.getLoaded(documentId);
    if (cached) {
      return of(cached as LoadedDocument);
    }

    const pending = this.inflight$.get(documentId);
    if (pending) {
      return pending;
    }

    const request$ = from(
      this.engine.ensureLoaded(documentId) as Promise<LoadedDocument>
    ).pipe(shareReplay(1));

    this.inflight$.set(documentId, request$);
    request$.subscribe({
      complete: () => this.inflight$.delete(documentId),
      error: () => this.inflight$.delete(documentId),
    });

    return request$;
  }

  /**
   * Progressive search (PR2b): load inverted index without content body.
   * Share in-flight requests per documentId.
   */
  ensureIndex(documentId: string): Observable<IndexedDocument> {
    if (isPopeDocumentId(documentId) || isSaintDocumentId(documentId)) {
      return this.ensureLoaded(documentId).pipe(
        map((full) => ({
          meta: full.meta,
          indice: full.indice,
          bodyLoaded: true,
          documento: full.documento,
        })),
      );
    }

    const full = this.engine.getLoaded(documentId);
    if (full) {
      return of({
        meta: full.meta,
        indice: full.indice,
        bodyLoaded: true,
        documento: full.documento,
      } as IndexedDocument);
    }
    const pending = this.indexInflight$.get(documentId);
    if (pending) return pending;

    const request$ = from(
      this.engine.ensureIndex(documentId) as Promise<IndexedDocument>,
    ).pipe(shareReplay(1));
    this.indexInflight$.set(documentId, request$);
    request$.subscribe({
      complete: () => this.indexInflight$.delete(documentId),
      error: () => this.indexInflight$.delete(documentId),
    });
    return request$;
  }

  getLoaded(documentId: string): LoadedDocument | undefined {
    const fromEngine = this.engine.getLoaded(documentId) as
      | LoadedDocument
      | undefined;
    if (fromEngine) return fromEngine;
    if (isSaintDocumentId(documentId)) {
      return this.saintPack().getLoaded(documentId);
    }
    if (isPopeDocumentId(documentId)) {
      return this.popePack().getLoaded(documentId);
    }
    return undefined;
  }

  /**
   * Reader path: body window, no index.json. Durable persist is background.
   */
  ensureWindow(
    documentId: string,
    focusIndex: number,
    radius: number
  ): Observable<LoadedDocument> {
    if (isPopeDocumentId(documentId) || isSaintDocumentId(documentId)) {
      return this.ensureLoaded(documentId);
    }
    return from(
      this.engine.ensureWindow(documentId, focusIndex, radius) as Promise<LoadedDocument>
    );
  }

  /** Fill more units of a windowed document (scroll / narrator). */
  ensureUnits(
    documentId: string,
    fromIndex: number,
    toIndex: number
  ): Observable<LoadedDocument> {
    if (isPopeDocumentId(documentId) || isSaintDocumentId(documentId)) {
      return this.ensureLoaded(documentId);
    }
    return from(
      this.engine.ensureUnits(documentId, fromIndex, toIndex) as Promise<LoadedDocument>
    );
  }

  /**
   * Load many inverted indexes with concurrency pool (PR2b ranking path).
   */
  ensureIndexMany(
    documentIds: string[],
    options: EnsureLoadedManyOptions = {},
  ): Observable<IndiceDocumentos[]> {
    return this.loadMany(
      documentIds,
      options,
      DEFAULT_INDEX_LOAD_CONCURRENCY,
      (id) =>
        this.ensureIndex(id).pipe(map((indexed) => this.toIndiceFromIndex(indexed))),
      'ensureIndexMany',
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
    return this.loadManifest().pipe(
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
    return this.loadMany(
      documentIds,
      options,
      DEFAULT_BODY_LOAD_CONCURRENCY,
      (id) =>
        this.ensureLoaded(id).pipe(map((loaded) => this.toIndiceDocumentos(loaded))),
      'ensureLoadedMany',
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
    return this.loadManifest().pipe(
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
    return this.loadManifest().pipe(
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
    return this.loadManifest().pipe(
      switchMap((metas) => {
        if (!metas.length) return of([]);
        return this.ensureLoadedMany(
          metas.map((m) => m.id),
          { concurrency: DEFAULT_BODY_LOAD_CONCURRENCY },
        );
      }),
    );
  }

  toIndiceDocumentos(loaded: LoadedDocument): IndiceDocumentos {
    return {
      id: loaded.meta.id,
      // Full title for UI; shortTitle kept for compact labels / legacy routes.
      nombre: loaded.meta.title || loaded.meta.shortTitle || loaded.meta.id,
      title: loaded.meta.title,
      shortTitle: loaded.meta.shortTitle,
      locale: loaded.meta.locale,
      sourceUrl: loaded.meta.sourceUrl,
      documento: loaded.documento,
      indice: loaded.indice,
      partial: loaded.partial,
    };
  }

  /** Index-only → IndiceDocumentos (empty documento until ensureLoaded). */
  toIndiceFromIndex(indexed: IndexedDocument): IndiceDocumentos {
    return {
      id: indexed.meta.id,
      nombre:
        indexed.meta.title || indexed.meta.shortTitle || indexed.meta.id,
      title: indexed.meta.title,
      shortTitle: indexed.meta.shortTitle,
      locale: indexed.meta.locale,
      sourceUrl: indexed.meta.sourceUrl,
      // Engine Article has optional index_array; stamp is applied on full load.
      documento: (indexed.bodyLoaded
        ? indexed.documento
        : []) as unknown as Article[],
      indice: indexed.indice as Indice,
    };
  }

  /** Human label for locale codes used in the corpus. */
  static localeLabel(locale?: string | null): string {
    return localeLabelPure(locale);
  }

  getArticle(
    documentId: string,
    indexOrConsecutivo: number | string
  ): Article | undefined {
    const loaded = this.getLoaded(documentId);
    if (!loaded) {
      return undefined;
    }

    if (typeof indexOrConsecutivo === 'number') {
      return loaded.documento[indexOrConsecutivo] as Article | undefined;
    }

    const asNumber = Number(indexOrConsecutivo);
    if (
      indexOrConsecutivo !== '' &&
      !Number.isNaN(asNumber) &&
      String(asNumber) === String(indexOrConsecutivo).trim()
    ) {
      const byIndex = loaded.documento[asNumber];
      if (byIndex) {
        return byIndex as Article;
      }
    }

    return loaded.documento.find(
      (a) => a.consecutivo === indexOrConsecutivo
    ) as Article | undefined;
  }

  normalizeIndex(raw: unknown): Indice {
    return this.engine.normalizeIndex(raw) as Indice;
  }

  /**
   * Paths may be absolute under `assets/...` or relative to the corpus root.
   */
  resolveAssetPath(path: string): string {
    return this.engine.resolveAssetPath(path);
  }

  private loadMany<T>(
    documentIds: string[],
    options: EnsureLoadedManyOptions,
    defaultConcurrency: number,
    load: (id: string) => Observable<T>,
    softFailLabel: string,
  ): Observable<T[]> {
    const ids = [...new Set(documentIds.filter(Boolean))];
    if (!ids.length) return of([]);
    const concurrency = options.concurrency ?? defaultConcurrency;
    const soft = options.softFail !== false;
    const isCancelled = options.isCancelled;

    return from(
      mapPool(
        ids,
        concurrency,
        async (id) => {
          if (isCancelled?.()) return null;
          try {
            return await firstValueFrom(load(id));
          } catch (err) {
            if (soft) {
              console.warn(`${softFailLabel} soft-fail ${id}`, err);
              return null;
            }
            throw err;
          }
        },
        isCancelled,
      ),
    ).pipe(map((rows) => rows.filter((d): d is T => d != null)));
  }
}
