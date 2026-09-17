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
  DocGraphFile,
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
  private readonly graphsLoaded = new Set<string>();
  private readonly graphsInflight$ = new Map<string, Observable<TopicPack>>();

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
        const base = packBase(root, loc);
        if (!base) {
          return of(emptyTopicPack(loc));
        }
        return this.http.get<TopicPackManifest>(`${base}/manifest.json`).pipe(
          switchMap((manifest) => this.loadCoreFiles(base, manifest, loc)),
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

  /**
   * Load unit-graph + doc-graph (and unitTopics) after the core pack.
   * Search / temas stay on loadPack; relaciones and related-units call this.
   */
  loadGraphs(locale: string): Observable<TopicPack> {
    const loc = normalizeLoc(locale) || 'es';
    if (!this.featureEnabled) {
      return of(emptyTopicPack(loc));
    }
    if (this.graphsLoaded.has(loc)) {
      const cached = this.packCache.get(loc);
      if (cached) return of(cached);
    }
    const pending = this.graphsInflight$.get(loc);
    if (pending) return pending;

    const request$ = this.loadPack(loc).pipe(
      switchMap((pack) => {
        if (this.graphsLoaded.has(loc)) {
          return of(this.packCache.get(loc) ?? pack);
        }
        const base = this.rootManifest
          ? packBase(this.rootManifest, loc)
          : null;
        if (!base) {
          this.graphsLoaded.add(loc);
          return of(pack);
        }
        return this.loadGraphFiles(base, pack.manifest).pipe(
          map((g) => {
            pack.graph = g.graph;
            pack.docGraph = g.docGraph;
            pack.unitTopics = g.unitTopics;
            this.packCache.set(loc, pack);
            this.graphsLoaded.add(loc);
            return pack;
          }),
        );
      }),
      shareReplay(1),
      tap({
        complete: () => this.graphsInflight$.delete(loc),
        error: () => this.graphsInflight$.delete(loc),
      }),
    );
    this.graphsInflight$.set(loc, request$);
    return request$;
  }

  private loadCoreFiles(
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

    return forkJoin({
      topics: topics$,
      postings: postings$,
      termTopics: termTopics$,
    }).pipe(
      map((parts) => ({
        manifest,
        topics: parts.topics,
        postings: parts.postings,
        termTopics: parts.termTopics,
        graph: null,
        docGraph: null,
        unitTopics: null,
      })),
    );
  }

  private loadGraphFiles(
    base: string,
    manifest: TopicPackManifest,
  ): Observable<{
    graph: UnitGraphFile | null;
    docGraph: DocGraphFile | null;
    unitTopics: UnitTopicsFile | null;
  }> {
    const f = manifest.files;
    const graph$ = f?.graph
      ? this.http.get<UnitGraphFile>(`${base}/${f.graph}`).pipe(
          catchError(() => of(null as UnitGraphFile | null)),
        )
      : of(null as UnitGraphFile | null);
    const unitTopics$ = f?.unitTopics
      ? this.http.get<UnitTopicsFile>(`${base}/${f.unitTopics}`).pipe(
          catchError(() => of(null as UnitTopicsFile | null)),
        )
      : of(null as UnitTopicsFile | null);
    const docGraph$ = f?.docGraph
      ? this.http.get<DocGraphFile>(`${base}/${f.docGraph}`).pipe(
          catchError(() => of(null as DocGraphFile | null)),
        )
      : of(null as DocGraphFile | null);

    return forkJoin({
      graph: graph$,
      unitTopics: unitTopics$,
      docGraph: docGraph$,
    });
  }
}

function packBase(root: TopicSearchRootManifest, loc: string): string | null {
  const rel = root.locales?.[loc];
  if (!rel) return null;
  return `${TOPIC_SEARCH_ROOT}/${rel}`.replace(/\/+/g, '/');
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
