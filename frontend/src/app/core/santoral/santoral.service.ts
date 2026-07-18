import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import {
  SANTORAL_MANIFEST_URL,
  SaintRecord,
  SantoralManifest,
  documentIdsForSaint,
  saintById,
  saintForDocument,
  saintsByEra,
  siblingDocumentIds,
  SantoralDocRef,
} from './santoral-resolve.logic';
import {
  isSaintDocumentId,
  parseSaintDocumentId,
  saintDocumentId,
  saintToReadingDocument,
  SaintLoadedDocument,
} from './santoral-units.logic';
import { CorpusService } from '../corpus/corpus.service';
import {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
} from '../corpus/corpus.models';

@Injectable({
  providedIn: 'root',
})
export class SantoralService {
  private manifest: SantoralManifest | null = null;
  private inflight$: Observable<SantoralManifest> | null = null;
  /** In-memory cache of materialized saint bios for the reader path. */
  private readonly saintDocs = new Map<string, LoadedDocument>();

  constructor(
    private readonly http: HttpClient,
    private readonly corpus: CorpusService,
  ) {}

  /** Offline pack URL (assets/corpus/santoral/manifest.json). */
  get manifestUrl(): string {
    return SANTORAL_MANIFEST_URL;
  }

  loadManifest(): Observable<SantoralManifest> {
    if (this.manifest) {
      return of(this.manifest);
    }
    if (this.inflight$) {
      return this.inflight$;
    }
    this.inflight$ = this.http.get<SantoralManifest>(SANTORAL_MANIFEST_URL).pipe(
      tap((m) => {
        this.manifest = m;
      }),
      catchError((err) => {
        console.warn('Santoral pack load failed', err);
        const empty: SantoralManifest = {
          version: '0',
          saints: [],
          sourceNote: 'Pack no disponible',
        };
        this.manifest = empty;
        return of(empty);
      }),
      shareReplay(1),
      tap({
        complete: () => {
          this.inflight$ = null;
        },
        error: () => {
          this.inflight$ = null;
        },
      }),
    );
    return this.inflight$;
  }

  listSaints(): SaintRecord[] {
    return this.manifest?.saints?.slice() || [];
  }

  getSaint(id: string): SaintRecord | undefined {
    return saintById(id, this.listSaints());
  }

  groupsByEra(): { era: string; items: SaintRecord[] }[] {
    return saintsByEra(this.listSaints());
  }

  /** Corpus docs as light refs (manifest must be loaded). */
  private corpusRefs(): SantoralDocRef[] {
    return this.corpus.listDocuments().map((d) => ({
      id: d.id,
      title: d.title,
      author: d.author,
    }));
  }

  /**
   * Resolved works for a saint (explicit + author match on corpus).
   * Returns { documentId, title } for UI.
   */
  worksForSaint(
    saint: SaintRecord,
  ): { documentId: string; title: string }[] {
    const docs = this.corpusRefs();
    const ids = documentIdsForSaint(saint, docs);
    return ids.map((id) => {
      const meta = this.corpus.getMeta(id);
      return {
        documentId: id,
        title: meta?.title || id,
      };
    });
  }

  /** Saint linked to a document (cover/menu references). */
  saintForDoc(documentId: string, author?: string): SaintRecord | undefined {
    return saintForDocument(
      { id: documentId, author },
      this.listSaints(),
    );
  }

  siblingsForDoc(
    documentId: string,
    author?: string,
  ): { documentId: string; title: string }[] {
    const docs = this.corpusRefs();
    const ids = siblingDocumentIds(
      { id: documentId, author },
      this.listSaints(),
      docs,
    );
    return ids.map((id) => {
      const meta = this.corpus.getMeta(id);
      return { documentId: id, title: meta?.title || id };
    });
  }

  /** Stable documentId for reading a saint biography in the real lector. */
  readingDocumentId(saintId: string): string {
    return saintDocumentId(saintId);
  }

  /** True when id is `santoral:{saintId}` (not a corpus pack id). */
  isReadingDocumentId(documentId: string | undefined | null): boolean {
    return isSaintDocumentId(documentId);
  }

  /**
   * Materialize saint bio as LoadedDocument for `/leyendo/santoral:…`.
   * Offline-only; does not touch the Biblioteca catalog.
   */
  ensureSaintLoaded(documentId: string): Observable<LoadedDocument> {
    if (!isSaintDocumentId(documentId)) {
      return throwError(
        () => new Error(`Not a santoral reading id: ${documentId}`),
      );
    }
    const cached = this.saintDocs.get(documentId);
    if (cached) {
      return of(cached);
    }
    const saintId = parseSaintDocumentId(documentId)!;
    return this.loadManifest().pipe(
      map(() => {
        const saint = this.getSaint(saintId);
        if (!saint) {
          throw new Error(`Santo no encontrado: ${saintId}`);
        }
        const built = saintToReadingDocument(saint);
        if (!built) {
          throw new Error(`No se pudo materializar biografía: ${saintId}`);
        }
        const loaded = this.toLoadedDocument(built);
        this.saintDocs.set(documentId, loaded);
        return loaded;
      }),
    );
  }

  /** Facade shape used by CargarDocumentosJsonService / lector. */
  ensureSaintAsIndice(documentId: string): Observable<IndiceDocumentos> {
    return this.ensureSaintLoaded(documentId).pipe(
      map((loaded) => ({
        id: loaded.meta.id,
        nombre: loaded.meta.title || loaded.meta.id,
        title: loaded.meta.title,
        shortTitle: loaded.meta.shortTitle,
        locale: loaded.meta.locale,
        sourceUrl: loaded.meta.sourceUrl,
        documento: loaded.documento as Article[],
        indice: loaded.indice as Indice,
      })),
    );
  }

  /** Meta for a materialized saint doc (for chrome that calls getMeta). */
  getSaintMeta(documentId: string): DocumentMeta | undefined {
    const cached = this.saintDocs.get(documentId);
    if (cached) return cached.meta;
    const saintId = parseSaintDocumentId(documentId);
    if (!saintId) return undefined;
    const saint = this.getSaint(saintId);
    if (!saint) return undefined;
    const built = saintToReadingDocument(saint);
    return built?.meta as DocumentMeta | undefined;
  }

  /**
   * Ensure saint bio is ready and return LoadedDocument (preload from cover).
   */
  loadReadingDocumentForSaint(saint: SaintRecord): Observable<LoadedDocument> {
    const id = saintDocumentId(saint.id);
    return this.ensureSaintLoaded(id);
  }

  private toLoadedDocument(built: SaintLoadedDocument): LoadedDocument {
    return {
      meta: built.meta as DocumentMeta,
      documento: built.documento as Article[],
      indice: built.indice as Indice,
    };
  }
}
