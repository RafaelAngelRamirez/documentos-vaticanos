import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, from, of } from 'rxjs';
import type { DownloadBytes } from './download-progress.logic';
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
  citeMapPathFromBody,
  type IndexedDocument,
} from './corpus-load.logic';
import { parseLectionaryPassage } from '../liturgia/bible-cite.logic';
import type { ParsedPassage } from '../liturgia/bible-cite.logic';
import {
  addressUnitsFromCiteMap,
  mergeUnitRanges,
  unitIndexesForPassage,
  type BibleCiteMap,
  type UnitRange,
} from '../liturgia/cite-map.logic';
import {
  documentParagraphNumber,
  indexOfParagraphNumber,
  isOfflineBibleId,
  normalizeCiteForParse,
  parseDocumentUnitSpans,
  type DocumentUnitSpan,
} from '../reading/resolve-cited-passage.logic';
import {
  assetUrlToPackRel,
  filesFromZip,
  installPatristicPack,
  readInstalledPack,
  sourceFromMap,
  type InstallPatristicResult,
  type PatristicPackStore,
} from './patristic-pack.logic';
import { openPatristicPackStore } from './patristic-pack.store';
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

/** Una unidad ya copiada fuera del caché del motor. */
export interface OpenedUnit {
  documentId: string;
  unitIndex: number;
  article: Article;
  meta: DocumentMeta;
}

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
  private packStorePromise: Promise<PatristicPackStore> | null = null;
  /**
   * Bytes of the corpus file in flight. Citation screens read this so a
   * cold fetch shows “Descargando…” instead of sitting on “Abriendo…”.
   * `ngsw-bypass` keeps that fetch off the asset prefetch queue.
   */
  private readonly progressState = new BehaviorSubject<DownloadBytes | null>(
    null,
  );
  readonly downloadProgress$ = this.progressState.asObservable();

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
      httpGet: <T>(url: string) => this.httpGet<T>(url),
      store: durableStore,
      readLocalJson: (url) => this.readPatristicJson(url),
      installedPack: () => this.installedPatristicMetas(),
    });
  }

  /**
   * Corpus GET that returns as soon as the network does. The service
   * worker otherwise holds the first citation behind a prefetch of
   * `/assets/**` (the bible pack) and the row never leaves “Abriendo…”.
   */
  private httpGet<T>(url: string): Promise<T> {
    this.progressState.next({ loaded: 0, total: null });
    return new Promise<T>((resolve, reject) => {
      const sub = this.http
        .get(url, {
          headers: { 'ngsw-bypass': 'true' },
          observe: 'events',
          reportProgress: true,
          responseType: 'json',
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress) {
              this.progressState.next({
                loaded: event.loaded,
                total: typeof event.total === 'number' ? event.total : null,
              });
            } else if (event.type === HttpEventType.Response) {
              sub.unsubscribe();
              if (event.body == null) {
                reject(new Error(`empty corpus response ${url}`));
                return;
              }
              resolve(event.body as T);
            }
          },
          error: (err: unknown) => {
            sub.unsubscribe();
            reject(err);
          },
        });
    });
  }

  private packStore(): Promise<PatristicPackStore> {
    if (!this.packStorePromise) {
      this.packStorePromise = openPatristicPackStore();
    }
    return this.packStorePromise;
  }

  private async installedPatristicMetas(): Promise<DocumentMeta[]> {
    try {
      const manifest = await readInstalledPack(await this.packStore());
      return (manifest?.documents ?? []) as DocumentMeta[];
    } catch {
      return [];
    }
  }

  private async readPatristicJson(url: string): Promise<unknown | undefined> {
    const rel = assetUrlToPackRel(url);
    if (!rel) return undefined;
    try {
      const bytes = await (await this.packStore()).read(rel);
      if (!bytes) return undefined;
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      return undefined;
    }
  }

  /**
   * Install a local zip of the patristic pack. Hash mismatch does not open it
   * and does not touch the network.
   */
  async installPatristicZip(bytes: Uint8Array): Promise<InstallPatristicResult> {
    let result: InstallPatristicResult;
    try {
      const files = await filesFromZip(bytes);
      result = await installPatristicPack(
        sourceFromMap(files),
        await this.packStore(),
      );
    } catch (err) {
      const reason =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo instalar el paquete';
      return { ok: false, reason };
    }
    if (result.ok) {
      this.engine.setInstalledPack(result.manifest.documents as DocumentMeta[]);
      this.manifestInflight$ = null;
    }
    return result;
  }

  async patristicPackStatus(): Promise<{
    installed: boolean;
    documentCount: number;
  }> {
    try {
      const manifest = await readInstalledPack(await this.packStore());
      const documentCount = manifest?.documents.length ?? 0;
      return { installed: documentCount > 0, documentCount };
    } catch {
      return { installed: false, documentCount: 0 };
    }
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
    this.citeMapCache.clear();
    this.citeMapInflight.clear();
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

  /**
   * Texto de las unidades que la búsqueda va a pintar.
   * Una ventana por unidad, copiada al momento: la ventana siguiente de la
   * misma obra no se queda con el artículo anterior. No pide index.json.
   */
  ensureUnitTexts(
    units: readonly { documentId: string; unitIndex: number }[],
    options: EnsureLoadedManyOptions = {},
  ): Observable<OpenedUnit[]> {
    const byDoc = new Map<string, number[]>();
    for (const unit of units) {
      const id = (unit?.documentId || '').trim();
      if (!id || !Number.isInteger(unit.unitIndex) || unit.unitIndex < 0) {
        continue;
      }
      const list = byDoc.get(id);
      if (list) {
        if (!list.includes(unit.unitIndex)) list.push(unit.unitIndex);
      } else {
        byDoc.set(id, [unit.unitIndex]);
      }
    }
    const ids = [...byDoc.keys()];
    if (!ids.length) return of([]);
    return from(
      mapPool(
        ids,
        options.concurrency ?? DEFAULT_BODY_LOAD_CONCURRENCY,
        async (id) => {
          const found: OpenedUnit[] = [];
          for (const unitIndex of byDoc.get(id) || []) {
            if (options.isCancelled?.()) return found;
            try {
              const loaded = await firstValueFrom(
                this.ensureWindow(id, unitIndex, 0),
              );
              const article = loaded.documento?.[unitIndex];
              if (!article || typeof article.contenido !== 'string') continue;
              found.push({
                documentId: loaded.meta.id,
                unitIndex,
                article,
                meta: loaded.meta,
              });
            } catch {
              return found;
            }
          }
          return found;
        },
        options.isCancelled,
      ),
    ).pipe(map((groups) => groups.flatMap((group) => group || [])));
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
   * Preload only the units a citation needs, then hand the body to
   * resolveCitedPassage*. Uses cite-map + ship chunks for bible packs;
   * falls back to ensureWindow (anchor) or ensureLoaded.
   */
  ensureForCitedPassage(
    documentId: string,
    opts: { citeLabel?: string; anchorIndex?: number } = {},
  ): Observable<LoadedDocument> {
    if (isPopeDocumentId(documentId) || isSaintDocumentId(documentId)) {
      return this.ensureLoaded(documentId);
    }
    return from(this.loadForCitedPassage(documentId, opts));
  }

  /** Edition whose units carry `biblia` and therefore a cite-map. */
  private readonly structuredBibleId = 'bible-pueblo-de-dios-es';

  /**
   * Cited verses only. Indexes come from the edition that has a cite-map
   * (Spanish, when the translation dropped `biblia`). The text is the
   * reader's edition; if that chunk is missing, the structured edition.
   * Never the whole bible.
   */
  private async openBibleCitation(
    documentId: string,
    passage: ParsedPassage,
  ): Promise<LoadedDocument | null> {
    const mapDocId = await this.bibleCiteMapDocument(documentId);
    if (!mapDocId) return null;
    const map = await this.loadCiteMap(mapDocId);
    if (!map) return null;
    const indexes = unitIndexesForPassage(map, passage);
    if (!indexes.length) return null;
    const loaded = await this.loadCitedRanges(
      documentId,
      mapDocId,
      mergeUnitRanges(indexes),
      indexes,
    );
    return this.citedBibleDocument(loaded, map, passage);
  }

  private async bibleCiteMapDocument(
    documentId: string,
  ): Promise<string | null> {
    if (await this.loadCiteMap(documentId)) return documentId;
    if (
      documentId !== this.structuredBibleId &&
      (await this.loadCiteMap(this.structuredBibleId))
    ) {
      return this.structuredBibleId;
    }
    return null;
  }

  private async loadCitedRanges(
    preferredId: string,
    mapDocId: string,
    ranges: UnitRange[],
    indexes: number[],
  ): Promise<LoadedDocument> {
    const tryId = async (id: string): Promise<LoadedDocument | null> => {
      try {
        let loaded: LoadedDocument | undefined;
        for (const range of ranges) {
          loaded = (await this.engine.ensureUnits(
            id,
            range.from,
            range.to,
          )) as LoadedDocument;
        }
        if (!loaded || !this.indexesHaveText(loaded, indexes)) return null;
        return loaded;
      } catch {
        return null;
      }
    };
    const preferred = await tryId(preferredId);
    if (preferred) return preferred;
    if (mapDocId !== preferredId) {
      const fallback = await tryId(mapDocId);
      if (fallback) return fallback;
    }
    throw new Error(`cited bible window missing: ${preferredId}`);
  }

  private indexesHaveText(doc: LoadedDocument, indexes: number[]): boolean {
    const units = doc.documento;
    if (!units) return false;
    return indexes.every((index) => {
      const text = units[index]?.contenido;
      return typeof text === 'string' && text.trim().length > 0;
    });
  }

  private citedBibleDocument(
    loaded: LoadedDocument,
    map: BibleCiteMap,
    passage: ParsedPassage,
  ): LoadedDocument {
    const documento = addressUnitsFromCiteMap(
      loaded.documento,
      map,
      passage,
    ) as Article[];
    return { ...loaded, documento };
  }

  private readonly citeMapCache = new Map<string, BibleCiteMap | null>();
  private readonly citeMapInflight = new Map<
    string,
    Promise<BibleCiteMap | null>
  >();

  private async loadForCitedPassage(
    documentId: string,
    opts: { citeLabel?: string; anchorIndex?: number },
  ): Promise<LoadedDocument> {
    const cachedFull = this.engine.getLoaded(documentId) as
      | LoadedDocument
      | undefined;
    if (cachedFull && !cachedFull.partial && cachedFull.documento?.length) {
      return cachedFull;
    }

    const label = (opts.citeLabel || '').trim();
    const anchor = opts.anchorIndex;
    if (
      !isOfflineBibleId(documentId) &&
      label &&
      typeof anchor === 'number' &&
      Number.isInteger(anchor) &&
      anchor >= 0
    ) {
      const spans = parseDocumentUnitSpans(label);
      if (spans?.length) {
        return this.loadDocumentSpans(documentId, anchor, spans);
      }
    }

    const passage: ParsedPassage | null = label
      ? parseLectionaryPassage(normalizeCiteForParse(label))
      : null;
    if (passage && isOfflineBibleId(documentId)) {
      const opened = await this.openBibleCitation(documentId, passage);
      if (opened) return opened;
      // A sibling map exists, so the verses are addressable. Do not pull
      // every chunk of a translation that has no verse marks: that download
      // is what sat on “Descargando…” and then came back empty.
      if (await this.bibleCiteMapDocument(documentId)) {
        throw new Error(`cited bible passage missing: ${documentId}`);
      }
    } else if (passage) {
      const map = await this.loadCiteMap(documentId);
      if (map) {
        const indexes = unitIndexesForPassage(map, passage);
        if (indexes.length) {
          const ranges = mergeUnitRanges(indexes);
          let loaded: LoadedDocument | undefined;
          for (const range of ranges) {
            loaded = (await this.engine.ensureUnits(
              documentId,
              range.from,
              range.to,
            )) as LoadedDocument;
          }
          if (loaded) return loaded;
        }
      }
    }

    if (
      typeof opts.anchorIndex === 'number' &&
      Number.isInteger(opts.anchorIndex) &&
      opts.anchorIndex >= 0
    ) {
      return this.engine.ensureWindow(
        documentId,
        opts.anchorIndex,
        2,
      ) as Promise<LoadedDocument>;
    }

    return this.engine.ensureLoaded(documentId) as Promise<LoadedDocument>;
  }

  /**
   * Load the paragraph runs a document citation names.
   * A pack without chunks comes back whole. A chunked pack loads the anchor
   * chunk first, then only the chunks that hold a run still missing.
   */
  private async loadDocumentSpans(
    documentId: string,
    anchor: number,
    spans: readonly DocumentUnitSpan[],
  ): Promise<LoadedDocument> {
    let loaded = (await this.engine.ensureUnits(
      documentId,
      anchor,
      anchor + 1,
    )) as LoadedDocument;
    if (!loaded?.partial) return loaded;

    const unitCount = loaded.meta?.unitCount || loaded.documento?.length || 0;
    if (unitCount <= 0) return loaded;

    const locate = async (n: number): Promise<number | null> => {
      const have = indexOfParagraphNumber(loaded.documento, n);
      if (have != null) return have;
      const found = await this.searchParagraphIndex(documentId, n, unitCount);
      const fresh = this.engine.getLoaded(documentId) as
        | LoadedDocument
        | undefined;
      if (fresh) loaded = fresh;
      return found;
    };

    for (const span of spans) {
      const startIdx = await locate(span.start);
      const endIdx =
        span.end === span.start ? startIdx : await locate(span.end);
      const bounds = [startIdx, endIdx].filter(
        (n): n is number => typeof n === 'number',
      );
      if (!bounds.length) continue;
      const from = Math.min(...bounds);
      const to = Math.max(...bounds) + 1;
      if (to <= from + 1) continue;
      if (to - from > 400) {
        loaded = (await this.engine.ensureUnits(
          documentId,
          from,
          from + 1,
        )) as LoadedDocument;
        loaded = (await this.engine.ensureUnits(
          documentId,
          to - 1,
          to,
        )) as LoadedDocument;
        continue;
      }
      loaded = (await this.engine.ensureUnits(
        documentId,
        from,
        to,
      )) as LoadedDocument;
    }

    return (
      (this.engine.getLoaded(documentId) as LoadedDocument | undefined) ||
      loaded
    );
  }

  /** Paragraph numbers increase with the unit index, with titles in between. */
  private async searchParagraphIndex(
    documentId: string,
    target: number,
    unitCount: number,
  ): Promise<number | null> {
    let lo = 0;
    let hi = unitCount - 1;
    for (let guard = 0; guard < 24 && lo <= hi; guard++) {
      const cached = this.engine.getLoaded(documentId) as
        | LoadedDocument
        | undefined;
      const direct = indexOfParagraphNumber(cached?.documento, target);
      if (direct != null) return direct;
      const mid = (lo + hi) >> 1;
      if (!cached?.documento?.[mid]) {
        await this.engine.ensureUnits(documentId, mid, mid + 1);
      }
      const doc = (
        this.engine.getLoaded(documentId) as LoadedDocument | undefined
      )?.documento;
      const again = indexOfParagraphNumber(doc, target);
      if (again != null) return again;
      const probe = nearestParagraph(doc, mid, lo, hi);
      if (!probe) return null;
      if (probe.value === target) return probe.index;
      if (probe.value < target) lo = Math.max(lo + 1, probe.index + 1);
      else hi = Math.min(hi - 1, probe.index - 1);
    }
    const doc = (
      this.engine.getLoaded(documentId) as LoadedDocument | undefined
    )?.documento;
    return indexOfParagraphNumber(doc, target);
  }

  private async loadCiteMap(
    documentId: string,
  ): Promise<BibleCiteMap | null> {
    if (this.citeMapCache.has(documentId)) {
      return this.citeMapCache.get(documentId) ?? null;
    }
    const pending = this.citeMapInflight.get(documentId);
    if (pending) return pending;

    const request = (async () => {
      const metas = await this.engine.loadManifest();
      const meta = metas.find((m) => m.id === documentId);
      if (!meta?.bodyPath) {
        this.citeMapCache.set(documentId, null);
        return null;
      }
      const url = this.engine.resolveAssetPath(
        citeMapPathFromBody(meta.bodyPath),
      );
      try {
        const raw = await this.httpGet<BibleCiteMap>(url);
        const ok =
          raw &&
          raw.v === 1 &&
          raw.books &&
          typeof raw.books === 'object'
            ? raw
            : null;
        this.citeMapCache.set(documentId, ok);
        return ok;
      } catch {
        this.citeMapCache.set(documentId, null);
        return null;
      } finally {
        this.citeMapInflight.delete(documentId);
      }
    })();
    this.citeMapInflight.set(documentId, request);
    return request;
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

function nearestParagraph(
  units: readonly { consecutivo?: string }[] | null | undefined,
  mid: number,
  lo: number,
  hi: number,
): { index: number; value: number } | null {
  if (!units?.length) return null;
  const left = Math.max(0, lo);
  const right = Math.min(units.length - 1, hi);
  for (let delta = 0; delta <= right - left; delta++) {
    const candidates = delta === 0 ? [mid] : [mid - delta, mid + delta];
    for (const index of candidates) {
      if (index < left || index > right) continue;
      const value = documentParagraphNumber(units[index]?.consecutivo);
      if (value != null) return { index, value };
    }
  }
  return null;
}
