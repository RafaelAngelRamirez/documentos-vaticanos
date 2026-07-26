import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  TOPIC_SEARCH_MANIFEST_URL,
  TOPIC_SEARCH_ROOT,
  TopicPack,
  TopicPackManifest,
  TopicPostingsFile,
  TopicRecord,
  TopicSearchRootManifest,
  TermTopicsFile,
  UnitGraphFile,
  UnitTopicsFile,
  emptyTopicPack,
} from './topic-pack.models';

/**
 * Loads offline topic-search packs (sibling of corpus/context).
 * Pattern: HistoricalContextService — HTTP + memory, graceful empty, no IDB in v1.
 */
@Injectable({
  providedIn: 'root',
})
export class TopicIndexService {
  private rootManifest: TopicSearchRootManifest | null = null;
  private rootInflight$: Observable<TopicSearchRootManifest> | null = null;
  private readonly packCache = new Map<string, TopicPack>();
  private readonly packInflight$ = new Map<string, Observable<TopicPack>>();

  constructor(private readonly http: HttpClient) {}

  /** Feature flag: pack load is a no-op empty when disabled. */
  get featureEnabled(): boolean {
    return environment.featureTopicSearch !== false;
  }

  isReady(locale: string): boolean {
    return this.packCache.has(normalizeLoc(locale));
  }

  getCatalog(locale: string): TopicRecord[] {
    return this.packCache.get(normalizeLoc(locale))?.topics ?? [];
  }

  getCachedPack(locale: string): TopicPack | null {
    return this.packCache.get(normalizeLoc(locale)) ?? null;
  }

  loadRootManifest(): Observable<TopicSearchRootManifest> {
    if (!this.featureEnabled) {
      return of({ version: '0', schema: 1, locales: {}, sourceNote: 'disabled' });
    }
    if (this.rootManifest) return of(this.rootManifest);
    if (this.rootInflight$) return this.rootInflight$;

    this.rootInflight$ = this.http
      .get<TopicSearchRootManifest>(TOPIC_SEARCH_MANIFEST_URL)
      .pipe(
        tap((m) => {
          this.rootManifest = m;
        }),
        catchError((err) => {
          console.warn('Topic search root manifest load failed', err);
          const empty: TopicSearchRootManifest = {
            version: '0',
            schema: 1,
            locales: {},
            sourceNote: 'Topic pack not available',
          };
          this.rootManifest = empty;
          return of(empty);
        }),
        shareReplay(1),
        tap({
          complete: () => {
            this.rootInflight$ = null;
          },
          error: () => {
            this.rootInflight$ = null;
          },
        }),
      );
    return this.rootInflight$;
  }

  /**
   * Load locale pack. Missing / error → empty pack (never throws to UI).
   */
  loadPack(locale: string): Observable<TopicPack> {
    const loc = normalizeLoc(locale) || 'es';
    if (!this.featureEnabled) {
      return of(emptyTopicPack(loc));
    }
    const cached = this.packCache.get(loc);
    if (cached) return of(cached);
    const pending = this.packInflight$.get(loc);
    if (pending) return pending;

    const request$ = this.loadRootManifest().pipe(
      switchMap((root) => {
        const rel = root.locales?.[loc];
        if (!rel) {
          return of(emptyTopicPack(loc));
        }
        const base = `${TOPIC_SEARCH_ROOT}/${rel}`.replace(/\/+/g, '/');
        return this.http.get<TopicPackManifest>(`${base}/manifest.json`).pipe(
          switchMap((manifest) => this.loadPackFiles(base, manifest, loc)),
          catchError((err) => {
            console.warn(`Topic pack load failed for ${loc}`, err);
            return of(emptyTopicPack(loc));
          }),
        );
      }),
      tap((pack) => this.packCache.set(loc, pack)),
      shareReplay(1),
      tap({
        complete: () => this.packInflight$.delete(loc),
        error: () => this.packInflight$.delete(loc),
      }),
    );
    this.packInflight$.set(loc, request$);
    return request$;
  }

  private loadPackFiles(
    base: string,
    manifest: TopicPackManifest,
    locale: string,
  ): Observable<TopicPack> {
    const f = manifest.files || {
      topics: 'topics.json',
      postings: 'topic-postings.json',
      termTopics: 'term-topics.json',
    };
    const topics$ = this.http
      .get<{ topics?: TopicRecord[] } | TopicRecord[]>(`${base}/${f.topics}`)
      .pipe(
        map((raw) => normalizeTopics(raw)),
        catchError(() => of([] as TopicRecord[])),
      );
    const postings$ = this.http
      .get<TopicPostingsFile>(`${base}/${f.postings}`)
      .pipe(
        catchError(() =>
          of({ version: 1, locale, postings: {} } as TopicPostingsFile),
        ),
      );
    const termTopics$ = this.http
      .get<TermTopicsFile>(`${base}/${f.termTopics}`)
      .pipe(
        catchError(() =>
          of({ version: 1, locale, terms: {} } as TermTopicsFile),
        ),
      );
    const graph$ = f.graph
      ? this.http.get<UnitGraphFile>(`${base}/${f.graph}`).pipe(
          catchError(() => of(null as UnitGraphFile | null)),
        )
      : of(null as UnitGraphFile | null);
    const unitTopics$ = f.unitTopics
      ? this.http.get<UnitTopicsFile>(`${base}/${f.unitTopics}`).pipe(
          catchError(() => of(null as UnitTopicsFile | null)),
        )
      : of(null as UnitTopicsFile | null);

    return forkJoin({
      topics: topics$,
      postings: postings$,
      termTopics: termTopics$,
      graph: graph$,
      unitTopics: unitTopics$,
    }).pipe(
      map((parts) => ({
        manifest,
        topics: parts.topics,
        postings: parts.postings,
        termTopics: parts.termTopics,
        graph: parts.graph,
        unitTopics: parts.unitTopics,
      })),
    );
  }
}

function normalizeLoc(locale: string): string {
  return (locale || '').trim().toLowerCase().split(/[-_]/)[0] || '';
}

function normalizeTopics(
  raw: { topics?: TopicRecord[] } | TopicRecord[] | null,
): TopicRecord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.topics) ? raw.topics : [];
}
