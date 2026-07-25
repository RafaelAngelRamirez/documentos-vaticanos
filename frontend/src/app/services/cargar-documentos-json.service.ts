import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
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

// Re-export models so existing imports keep working.
export type {
  Article,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
  Referencia,
};

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
   * Populated after {@link ensureAllLoaded} / individual loads.
   * Prefer async APIs for new code.
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
   * Load manifest + every document body/index.
   * Used by full-text search / related panels — not Biblioteca (catalog = manifest only).
   */
  ensureAllLoaded(): Observable<IndiceDocumentos[]> {
    return this.corpus.loadManifest().pipe(
      switchMap((metas) => {
        if (!metas.length) {
          this.documentos_disponibles = [];
          return of([]);
        }
        return forkJoin(metas.map((m) => this.ensureLoaded(m.id))).pipe(
          tap((docs) => {
            this.documentos_disponibles = docs;
          })
        );
      })
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
