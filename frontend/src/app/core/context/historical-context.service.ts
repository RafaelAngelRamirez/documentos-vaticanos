import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import {
  AuthorContextProfile,
  DocumentContextOverlay,
  HISTORICAL_CONTEXT_MANIFEST_URL,
  HistoricalContextManifest,
  ResolvedHistoricalContext,
} from './historical-context.models';
import { resolveHistoricalContext } from './historical-context-resolve.logic';

const ASSETS_CONTEXT_ROOT = 'assets/corpus/context';

/** Known id aliases between santoral / padres seeds and context profiles. */
const AUTHOR_ID_ALIASES: Record<string, string[]> = {
  'anonimo-diogneto': ['diogneto-anonimo'],
  'diogneto-anonimo': ['anonimo-diogneto'],
};

function authorIdCandidates(id: string): string[] {
  return [id, ...(AUTHOR_ID_ALIASES[id] || [])];
}

function profileToSaintContext(
  saintId: string,
  author: AuthorContextProfile | null,
): ResolvedHistoricalContext | null {
  if (!author) return null;
  return resolveHistoricalContext(
    `saint:${saintId}`,
    {
      documentId: `saint:${saintId}`,
      authorProfileId: author.id,
      chronologyNote:
        'Perfil general del autor/santo (todas las obras del corpus).',
      chronologyRefIds: author.summaryRefIds || author.references?.map((r) => r.id!).filter(Boolean),
      compositionYears: author.years,
      workSummary:
        'Vista de autor: el contexto general aplica a todas las obras enlazadas; cada libro del corpus aporta su tramo cronológico propio en su ficha.',
      workSummaryRefIds: author.summaryRefIds || author.references?.map((r) => r.id!).filter(Boolean),
    },
    author,
  );
}

@Injectable({
  providedIn: 'root',
})
export class HistoricalContextService {
  private manifest: HistoricalContextManifest | null = null;
  private inflight$: Observable<HistoricalContextManifest> | null = null;
  private authorCache = new Map<string, AuthorContextProfile>();
  private docCache = new Map<string, DocumentContextOverlay>();
  private resolvedCache = new Map<string, ResolvedHistoricalContext | null>();

  constructor(private readonly http: HttpClient) {}

  get manifestUrl(): string {
    return HISTORICAL_CONTEXT_MANIFEST_URL;
  }

  loadManifest(): Observable<HistoricalContextManifest> {
    if (this.manifest) return of(this.manifest);
    if (this.inflight$) return this.inflight$;
    this.inflight$ = this.http
      .get<HistoricalContextManifest>(HISTORICAL_CONTEXT_MANIFEST_URL)
      .pipe(
        tap((m) => {
          this.manifest = m;
        }),
        catchError((err) => {
          console.warn('Historical context pack load failed', err);
          const empty: HistoricalContextManifest = {
            version: '0',
            authors: [],
            documents: [],
            sourceNote: 'Pack de contexto no disponible',
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

  /**
   * Resolve offline context for a documentId (author general + obra).
   * Missing pack / missing doc → null (UI must not break the reader).
   */
  contextForDocument(
    documentId: string,
  ): Observable<ResolvedHistoricalContext | null> {
    if (!documentId) return of(null);
    if (this.resolvedCache.has(documentId)) {
      return of(this.resolvedCache.get(documentId) || null);
    }
    return this.loadManifest().pipe(
      switchMap((manifest) => {
        const entry = (manifest.documents || []).find(
          (d) => d.documentId === documentId,
        );
        if (!entry) {
          this.resolvedCache.set(documentId, null);
          return of(null);
        }
        const docPath = `${ASSETS_CONTEXT_ROOT}/${entry.path}`.replace(
          /\/+/g,
          '/',
        );
        const overlay$ = this.loadDocumentOverlay(entry.documentId, docPath);
        const authorId = entry.authorProfileId;
        const author$ = authorId
          ? this.loadAuthor(authorId, manifest)
          : of(null as AuthorContextProfile | null);
        return forkJoin({ overlay: overlay$, author: author$ }).pipe(
          map(({ overlay, author }) => {
            const resolved = resolveHistoricalContext(
              documentId,
              overlay,
              author,
            );
            this.resolvedCache.set(documentId, resolved);
            return resolved;
          }),
        );
      }),
      catchError(() => {
        this.resolvedCache.set(documentId, null);
        return of(null);
      }),
    );
  }

  /**
   * Author/era profile for santoral / padres (by profile id, saintId, or alias).
   */
  contextForSaint(
    saintId: string,
  ): Observable<ResolvedHistoricalContext | null> {
    if (!saintId) return of(null);
    const candidates = authorIdCandidates(saintId);
    return this.loadManifest().pipe(
      switchMap((manifest) => {
        const byId = (manifest.authors || []).find((a) =>
          candidates.includes(a.id),
        );
        if (byId) {
          return this.loadAuthor(byId.id, manifest).pipe(
            map((author) => profileToSaintContext(saintId, author)),
          );
        }
        const loads = (manifest.authors || []).map((a) =>
          this.loadAuthor(a.id, manifest),
        );
        if (!loads.length) return of(null);
        return forkJoin(loads).pipe(
          map((authors) => {
            const author = authors.find(
              (a) =>
                a &&
                (candidates.includes(a.id) ||
                  (a.saintId && candidates.includes(a.saintId))),
            );
            return profileToSaintContext(saintId, author || null);
          }),
        );
      }),
      catchError(() => of(null)),
    );
  }

  private loadDocumentOverlay(
    documentId: string,
    url: string,
  ): Observable<DocumentContextOverlay | null> {
    if (this.docCache.has(documentId)) {
      return of(this.docCache.get(documentId) || null);
    }
    return this.http.get<DocumentContextOverlay>(url).pipe(
      tap((o) => this.docCache.set(documentId, o)),
      catchError(() => of(null)),
    );
  }

  private loadAuthor(
    authorId: string,
    manifest: HistoricalContextManifest,
  ): Observable<AuthorContextProfile | null> {
    if (this.authorCache.has(authorId)) {
      return of(this.authorCache.get(authorId) || null);
    }
    const entry = (manifest.authors || []).find((a) => a.id === authorId);
    if (!entry) return of(null);
    const url = `${ASSETS_CONTEXT_ROOT}/${entry.path}`.replace(/\/+/g, '/');
    return this.http.get<AuthorContextProfile>(url).pipe(
      tap((a) => this.authorCache.set(authorId, a)),
      catchError(() => of(null)),
    );
  }
}
