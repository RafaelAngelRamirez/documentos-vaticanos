import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, shareReplay, switchMap, tap } from 'rxjs/operators';
import {
  Article,
  CorpusManifest,
  DocumentMeta,
  Indice,
  IndiceDocumentos,
  LoadedDocument,
} from './corpus.models';

const CORPUS_ROOT = 'assets/corpus';
const MANIFEST_URL = `${CORPUS_ROOT}/manifest.json`;

@Injectable({
  providedIn: 'root',
})
export class CorpusService {
  private manifest: DocumentMeta[] | null = null;
  private manifestInflight: Observable<DocumentMeta[]> | null = null;

  private readonly cache = new Map<string, LoadedDocument>();
  private readonly inflight = new Map<string, Observable<LoadedDocument>>();

  constructor(private readonly http: HttpClient) {}

  loadManifest(): Observable<DocumentMeta[]> {
    if (this.manifest) {
      return of(this.manifest);
    }
    if (this.manifestInflight) {
      return this.manifestInflight;
    }

    this.manifestInflight = this.http.get<CorpusManifest>(MANIFEST_URL).pipe(
      map((manifest) => manifest?.documents ?? []),
      tap((documents) => {
        this.manifest = documents;
        this.manifestInflight = null;
      }),
      shareReplay(1)
    );

    return this.manifestInflight;
  }

  listDocuments(): DocumentMeta[] {
    return this.manifest ? [...this.manifest] : [];
  }

  getMeta(documentId: string): DocumentMeta | undefined {
    return this.manifest?.find((d) => this.matchesMeta(d, documentId));
  }

  /**
   * Resolve meta by stable id or legacy display title used in routes.
   */
  resolveMeta(idOrTitle: string): DocumentMeta | undefined {
    return this.getMeta(idOrTitle);
  }

  ensureLoaded(documentId: string): Observable<LoadedDocument> {
    const cached = this.cache.get(documentId);
    if (cached) {
      return of(cached);
    }

    const pending = this.inflight.get(documentId);
    if (pending) {
      return pending;
    }

    const request$ = this.loadManifest().pipe(
      switchMap((metas) => {
        const meta = metas.find((m) => this.matchesMeta(m, documentId));

        if (!meta) {
          return throwError(
            () => new Error(`Document not found in manifest: ${documentId}`)
          );
        }

        const byId = this.cache.get(meta.id);
        if (byId) {
          return of(byId);
        }

        const bodyUrl = this.resolveAssetPath(meta.bodyPath);
        const indexUrl = this.resolveAssetPath(meta.indexPath);

        return this.http.get<Article[]>(bodyUrl).pipe(
          switchMap((body) =>
            this.http.get<unknown>(indexUrl).pipe(
              map((rawIndex) => {
                const documento = this.stampIndexArray(
                  Array.isArray(body) ? ([...body] as Article[]) : []
                );
                const indice = this.normalizeIndex(rawIndex);
                const loaded: LoadedDocument = {
                  meta,
                  documento,
                  indice,
                };
                this.remember(loaded);
                return loaded;
              })
            )
          )
        );
      }),
      tap({
        next: () => this.inflight.delete(documentId),
        error: () => this.inflight.delete(documentId),
      }),
      shareReplay(1)
    );

    this.inflight.set(documentId, request$);
    return request$;
  }

  getLoaded(documentId: string): LoadedDocument | undefined {
    return this.cache.get(documentId);
  }

  toIndiceDocumentos(loaded: LoadedDocument): IndiceDocumentos {
    return {
      id: loaded.meta.id,
      // Prefer shortTitle for routes/labels that historically used "Catecismo" / "Biblia".
      nombre: loaded.meta.shortTitle || loaded.meta.title,
      documento: loaded.documento,
      indice: loaded.indice,
    };
  }

  getArticle(
    documentId: string,
    indexOrConsecutivo: number | string
  ): Article | undefined {
    const loaded = this.cache.get(documentId);
    if (!loaded) {
      return undefined;
    }

    if (typeof indexOrConsecutivo === 'number') {
      return loaded.documento[indexOrConsecutivo];
    }

    const asNumber = Number(indexOrConsecutivo);
    if (
      indexOrConsecutivo !== '' &&
      !Number.isNaN(asNumber) &&
      String(asNumber) === String(indexOrConsecutivo).trim()
    ) {
      const byIndex = loaded.documento[asNumber];
      if (byIndex) {
        return byIndex;
      }
    }

    return loaded.documento.find((a) => a.consecutivo === indexOrConsecutivo);
  }

  normalizeIndex(raw: unknown): Indice {
    if (!raw || typeof raw !== 'object') {
      return { indice: {}, indice_por_punto: {} };
    }

    const obj = raw as Record<string, unknown>;

    if (
      obj['indice'] &&
      typeof obj['indice'] === 'object' &&
      !Array.isArray(obj['indice'])
    ) {
      const indice = obj['indice'] as Indice['indice'];
      const indice_por_punto =
        obj['indice_por_punto'] &&
        typeof obj['indice_por_punto'] === 'object' &&
        !Array.isArray(obj['indice_por_punto'])
          ? (obj['indice_por_punto'] as Indice['indice_por_punto'])
          : {};
      return { indice, indice_por_punto };
    }

    // Flat word → positions map (legacy / simplified index files).
    return {
      indice: obj as Indice['indice'],
      indice_por_punto: {},
    };
  }

  /**
   * Paths may be absolute under `assets/...` or relative to the corpus root.
   */
  resolveAssetPath(path: string): string {
    const cleaned = path.replace(/^\//, '');
    if (cleaned.startsWith('assets/')) {
      return cleaned;
    }
    return `${CORPUS_ROOT}/${cleaned}`;
  }

  private matchesMeta(meta: DocumentMeta, idOrTitle: string): boolean {
    return (
      meta.id === idOrTitle ||
      meta.title === idOrTitle ||
      meta.shortTitle === idOrTitle
    );
  }

  private remember(loaded: LoadedDocument): void {
    this.cache.set(loaded.meta.id, loaded);
    this.cache.set(loaded.meta.title, loaded);
    if (loaded.meta.shortTitle) {
      this.cache.set(loaded.meta.shortTitle, loaded);
    }
  }

  private stampIndexArray(articles: Article[]): Article[] {
    articles.forEach((article, i) => {
      article.index_array = i;
    });
    return articles;
  }
}
