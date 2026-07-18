import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, from, of } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
} from './corpus.models';
import { IndexedDbCorpusStore } from './corpus-durable-idb.store';
import { CorpusLoadEngine } from './corpus-load.logic';
import {
  DocumentFamily,
  editionsForDocument,
  familyKey,
  listPreferredEditions,
  localeLabel as localeLabelPure,
  multiLocaleSubtitle,
  pickPreferredEdition,
} from './document-locale.logic';

@Injectable({
  providedIn: 'root',
})
export class CorpusService {
  private readonly engine: CorpusLoadEngine;

  /** In-flight Observable wrappers so concurrent subscribers share one request. */
  private manifestInflight$: Observable<DocumentMeta[]> | null = null;
  private readonly inflight$ = new Map<string, Observable<LoadedDocument>>();

  constructor(
    private readonly http: HttpClient,
    durableStore: IndexedDbCorpusStore
  ) {
    this.engine = new CorpusLoadEngine({
      httpGet: <T>(url: string) => firstValueFrom(this.http.get<T>(url)),
      store: durableStore,
    });
  }

  /** Drop in-memory only (durable kept). Used by tests simulating reload. */
  clearMemoryCache(): void {
    this.engine.clearMemory();
    this.manifestInflight$ = null;
    this.inflight$.clear();
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
    return this.engine.getMeta(documentId) as DocumentMeta | undefined;
  }

  /**
   * Resolve meta by stable id or legacy display title used in routes.
   */
  resolveMeta(idOrTitle: string): DocumentMeta | undefined {
    return this.getMeta(idOrTitle);
  }

  ensureLoaded(documentId: string): Observable<LoadedDocument> {
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

  getLoaded(documentId: string): LoadedDocument | undefined {
    return this.engine.getLoaded(documentId) as LoadedDocument | undefined;
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
    const loaded = this.engine.getLoaded(documentId);
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
}
