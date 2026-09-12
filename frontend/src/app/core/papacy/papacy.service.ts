import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { CorpusService } from '../corpus/corpus.service';
import {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
} from '../corpus/corpus.models';
import {
  PAPACY_MANIFEST_URL,
  corpusWorks,
  preferLocaleDocumentIds,
  popeById,
  popeForDocument,
  popesByEra,
  siblingDocumentIds,
} from './papacy-resolve.logic';
import {
  isPopeDocumentId,
  parsePopeDocumentId,
  popeDocumentId,
  popeToReadingDocument,
} from './papacy-units.logic';
import type { PapacyManifest, PopeRecord } from './papacy.models';

@Injectable({
  providedIn: 'root',
})
export class PapacyService {
  private manifest: PapacyManifest | null = null;
  private inflight$: Observable<PapacyManifest> | null = null;
  private readonly popeDocs = new Map<string, LoadedDocument>();

  constructor(
    private readonly http: HttpClient,
    private readonly corpus: CorpusService,
  ) {}

  get manifestUrl(): string {
    return PAPACY_MANIFEST_URL;
  }

  loadManifest(): Observable<PapacyManifest> {
    if (this.manifest) return of(this.manifest);
    if (this.inflight$) return this.inflight$;
    this.inflight$ = this.http.get<PapacyManifest>(PAPACY_MANIFEST_URL).pipe(
      tap((m) => {
        this.manifest = m;
      }),
      catchError((err) => {
        console.warn('Papacy pack load failed', err);
        const empty: PapacyManifest = {
          version: '0',
          popes: [],
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

  listPopes(): PopeRecord[] {
    return this.manifest?.popes?.slice() || [];
  }

  getPope(id: string): PopeRecord | undefined {
    return popeById(id, this.listPopes());
  }

  groupsByEra(): { era: string; items: PopeRecord[] }[] {
    return popesByEra(this.listPopes());
  }

  worksForPope(pope: PopeRecord): { documentId: string; title: string }[] {
    const rows = corpusWorks(pope)
      .map((w) => {
        const id = w.documentId || '';
        const meta = id ? this.corpus.getMeta(id) : undefined;
        return {
          documentId: id,
          title: meta?.title || w.title || id,
        };
      })
      .filter((w) => w.documentId);
    const preferred = new Set(
      preferLocaleDocumentIds(
        rows.map((r) => r.documentId),
        'es',
      ),
    );
    return rows.filter((r) => preferred.has(r.documentId));
  }

  popeForDoc(documentId: string): PopeRecord | undefined {
    return popeForDocument({ id: documentId }, this.listPopes());
  }

  siblingsForDoc(
    documentId: string,
  ): { documentId: string; title: string }[] {
    const ids = siblingDocumentIds({ id: documentId }, this.listPopes());
    return ids.map((id) => {
      const meta = this.corpus.getMeta(id);
      return { documentId: id, title: meta?.title || id };
    });
  }

  readingDocumentId(popeId: string): string {
    return popeDocumentId(popeId);
  }

  isReadingDocumentId(documentId: string | undefined | null): boolean {
    return isPopeDocumentId(documentId);
  }

  ensurePopeLoaded(documentId: string): Observable<LoadedDocument> {
    if (!isPopeDocumentId(documentId)) {
      return throwError(
        () => new Error(`Not a papacy reading id: ${documentId}`),
      );
    }
    const cached = this.popeDocs.get(documentId);
    if (cached) return of(cached);
    const popeId = parsePopeDocumentId(documentId)!;
    return this.loadManifest().pipe(
      map(() => {
        const pope = this.getPope(popeId);
        if (!pope) throw new Error(`Papa no encontrado: ${popeId}`);
        const built = popeToReadingDocument(pope);
        if (!built) {
          throw new Error(`No se pudo materializar ficha: ${popeId}`);
        }
        this.popeDocs.set(documentId, built);
        return built;
      }),
    );
  }

  ensurePopeAsIndice(documentId: string): Observable<IndiceDocumentos> {
    return this.ensurePopeLoaded(documentId).pipe(
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

  getPopeMeta(documentId: string): DocumentMeta | undefined {
    const cached = this.popeDocs.get(documentId);
    if (cached) return cached.meta;
    const popeId = parsePopeDocumentId(documentId);
    if (!popeId) return undefined;
    const pope = this.getPope(popeId);
    if (!pope) return undefined;
    return popeToReadingDocument(pope)?.meta;
  }

  loadReadingDocumentForPope(pope: PopeRecord): Observable<LoadedDocument> {
    return this.ensurePopeLoaded(popeDocumentId(pope.id));
  }
}
