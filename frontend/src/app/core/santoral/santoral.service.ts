import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
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
import { CorpusService } from '../corpus/corpus.service';

@Injectable({
  providedIn: 'root',
})
export class SantoralService {
  private manifest: SantoralManifest | null = null;
  private inflight$: Observable<SantoralManifest> | null = null;

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

}
