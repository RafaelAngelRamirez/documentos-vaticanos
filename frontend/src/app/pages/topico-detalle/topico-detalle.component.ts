import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { ReadingCtasComponent } from 'src/app/components/reading-cover/reading-ctas.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { IndiceDocumentos } from 'src/app/core/corpus/corpus.models';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import {
  TopicCitation,
  TopicPack,
  TopicRecord,
} from 'src/app/core/search/topic-pack.models';
import { TopicIndexService } from 'src/app/core/search/topic-index.service';
import { findTopicInPack } from 'src/app/core/search/topic-query.logic';
import { DEFAULT_BODY_LOAD_CONCURRENCY } from 'src/app/core/search/search-load.logic';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';

/** Rows shown before “Ver más”. */
const VISIBLE_LIMIT = 40;
/** Cap unique document packs hydrated for unit body snippets. */
const SNIPPET_DOC_CAP = 24;
/** Default plain-text snippet length (chars). */
const SNIPPET_MAX = 160;

export interface TopicCitationRow {
  documentId: string;
  unitIndex: number;
  consecutivo?: string;
  conf?: number;
  /** Display title from corpus meta when available. */
  title: string;
  label: string;
  /**
   * Plain unit extract when body is hydrated; else
   * `documentId · índice unitIndex` fallback.
   */
  snippet: string;
}

/**
 * Canonical offline topic page (PR6): `/explorar/topicos/:slug`.
 * Corpus topic index — not user “Mis temas”.
 */
@Component({
  standalone: true,
  selector: 'app-topico-detalle',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    WbarComponent,
    BnavComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './topico-detalle.component.html',
  styleUrls: ['./topico-detalle.component.css'],
})
export class TopicoDetalleComponent implements OnInit, OnDestroy {
  /** Raw route param (may be full `topic:es:slug`). */
  rawSlug = '';
  /** Normalized slug for links / findTopic. */
  slug = '';
  topic: TopicRecord | null = null;
  postings: TopicCitationRow[] = [];
  related: TopicRecord[] = [];
  loading = true;
  /** Pack missing / empty catalog. */
  packEmpty = false;
  /** Topic slug not found in catalog. */
  notFound = false;
  showAll = false;
  locale = 'es';
  /** True while body packs for snippets are loading. */
  snippetsLoading = false;

  private sub = new Subscription();
  /** Bump on slug change / destroy to cancel stale hydrate. */
  private snippetGen = 0;
  /** documentId → full pack (bodies) after ensureLoadedMany. */
  private bodyByDocId = new Map<string, IndiceDocumentos>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private topics: TopicIndexService,
    private readerPrefs: ReaderPreferencesService,
    private nav: NavigationService,
    private corpus: CorpusService,
    private docs: CargarDocumentosJsonService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.route.paramMap.subscribe((pm) => {
        this.rawSlug = (pm.get('slug') || '').trim();
        this.slug = stripTopicIdToSlug(this.rawSlug);
        this.load();
      }),
    );
  }

  ngOnDestroy(): void {
    this.snippetGen++;
    this.sub.unsubscribe();
  }

  get fbarTitle(): string {
    return this.topic?.label || this.slug || 'Tema';
  }

  get lede(): string {
    if (!this.topic) return '';
    const aliases = (this.topic.aliases || []).filter(Boolean);
    if (aliases.length) {
      return aliases.slice(0, 6).join(' · ');
    }
    const parts: string[] = [];
    if (this.topic.unitCount != null) {
      parts.push(
        `${this.topic.unitCount} cita${this.topic.unitCount === 1 ? '' : 's'}`,
      );
    }
    if (this.topic.documentCount != null) {
      parts.push(
        `${this.topic.documentCount} documento${
          this.topic.documentCount === 1 ? '' : 's'
        }`,
      );
    }
    if (this.postings.length && !parts.length) {
      parts.push(
        `${this.postings.length} cita${this.postings.length === 1 ? '' : 's'} en el índice`,
      );
    }
    return parts.join(' · ');
  }

  get hasPostings(): boolean {
    return this.postings.length > 0;
  }

  get visiblePostings(): TopicCitationRow[] {
    if (this.showAll) return this.postings;
    return this.postings.slice(0, VISIBLE_LIMIT);
  }

  get hasMore(): boolean {
    return !this.showAll && this.postings.length > VISIBLE_LIMIT;
  }

  get remainingCount(): number {
    return Math.max(0, this.postings.length - VISIBLE_LIMIT);
  }

  get firstPosting(): TopicCitationRow | null {
    return this.postings[0] || null;
  }

  load(): void {
    // Cancel any in-flight snippet hydrate for previous slug.
    this.snippetGen++;
    this.bodyByDocId.clear();
    this.snippetsLoading = false;

    this.loading = true;
    this.topic = null;
    this.postings = [];
    this.related = [];
    this.packEmpty = false;
    this.notFound = false;
    this.showAll = false;

    if (!this.slug && !this.rawSlug) {
      this.loading = false;
      this.notFound = true;
      return;
    }

    this.locale = this.readerPrefs.resolveContentLocale() || 'es';
    const query = this.slug || this.rawSlug;

    // Titles for citation rows (manifest only — no ensureAllLoaded).
    this.corpus.loadManifest().subscribe({
      next: () => this.loadTopicPack(query),
      error: () => this.loadTopicPack(query),
    });
  }

  private loadTopicPack(query: string): void {
    this.topics.loadPack(this.locale).subscribe({
      next: (pack) => this.applyPack(pack, query),
      error: () => {
        this.loading = false;
        this.packEmpty = true;
      },
    });
  }

  private applyPack(pack: TopicPack, query: string): void {
    this.loading = false;
    const catalogEmpty = !pack.topics?.length;
    // findTopicInPack returns a slim like-type; re-resolve full TopicRecord from pack.
    const found = findTopicInPack(pack, query);
    const topic = found
      ? pack.topics.find(
          (t) =>
            t.id === found.id ||
            t.slug === found.slug ||
            t.id === found.slug ||
            t.slug === found.id,
        ) || null
      : null;
    if (!topic) {
      this.notFound = true;
      this.packEmpty = catalogEmpty;
      return;
    }

    this.topic = topic;
    this.slug = topic.slug || this.slug;

    const rawList: TopicCitation[] =
      pack.postings?.postings?.[topic.id] ||
      pack.postings?.postings?.[query] ||
      [];

    this.postings = sortCitations(rawList).map((c) =>
      toCitationRow(c, this.corpus),
    );
    this.related = resolveRelated(topic, pack.topics);

    // Titles first; hydrate unit bodies only for top visible unique docs.
    this.hydrateSnippets();
  }

  /**
   * Load content.json only for unique documentIds among currently visible
   * postings (capped at SNIPPET_DOC_CAP). Never loads the whole corpus.
   */
  private hydrateSnippets(): void {
    const visible = this.visiblePostings;
    if (!visible.length) {
      this.snippetsLoading = false;
      return;
    }

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of visible) {
      if (!row.documentId || seen.has(row.documentId)) continue;
      if (this.bodyByDocId.has(row.documentId)) continue;
      seen.add(row.documentId);
      ids.push(row.documentId);
      if (ids.length >= SNIPPET_DOC_CAP) break;
    }

    // Re-apply snippets for any bodies already in memory (e.g. expand).
    if (!ids.length) {
      this.applySnippetsFromBodies();
      this.snippetsLoading = false;
      return;
    }

    const myGen = ++this.snippetGen;
    this.snippetsLoading = true;

    this.sub.add(
      this.docs
        .ensureLoadedMany(ids, {
          concurrency: DEFAULT_BODY_LOAD_CONCURRENCY,
          isCancelled: () => myGen !== this.snippetGen,
        })
        .subscribe({
          next: (fullDocs) => {
            if (myGen !== this.snippetGen) return;
            for (const d of fullDocs) {
              const id = d.id || d.nombre || '';
              if (id) this.bodyByDocId.set(id, d);
            }
            this.applySnippetsFromBodies();
            this.snippetsLoading = false;
          },
          error: () => {
            if (myGen !== this.snippetGen) return;
            // Soft-degrade: keep fallback snippets.
            this.snippetsLoading = false;
          },
        }),
    );
  }

  private applySnippetsFromBodies(): void {
    for (const row of this.postings) {
      const doc = this.bodyByDocId.get(row.documentId);
      const unit = doc?.documento?.[row.unitIndex];
      const snip = plainSnippet(unit?.contenido, SNIPPET_MAX);
      if (snip) {
        row.snippet = snip;
      }
      // else keep existing fallback
    }
  }

  openFirst(autoNarr = false): void {
    const first = this.firstPosting;
    if (!first) return;
    this.nav.navigateToUnit(first.documentId, first.unitIndex, {
      consecutivo: first.consecutivo,
      autoNarr,
    });
  }

  openCitation(row: TopicCitationRow): void {
    this.nav.navigateToUnit(row.documentId, row.unitIndex, {
      consecutivo: row.consecutivo,
      label: row.title,
    });
  }

  goSearch(): void {
    const slug = this.slug || this.rawSlug;
    this.router.navigate(['/buscar'], {
      queryParams: { mode: 'topic', slug },
    });
  }

  expandList(): void {
    this.showAll = true;
    // Hydrate additional unique docs among newly visible rows.
    this.hydrateSnippets();
  }

  confLabel(conf: number | undefined): string {
    if (conf == null || !Number.isFinite(conf)) return '';
    const pct = Math.round(conf * 100);
    if (pct <= 0) return '';
    return `${pct}%`;
  }
}

/** `topic:es:gracia` → `gracia`; plain slug unchanged. */
export function stripTopicIdToSlug(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const m = /^topic:[^:]+:(.+)$/i.exec(s);
  return (m?.[1] || s).trim();
}

/**
 * Plain list snippet from unit body: strip `[+[n]+]` markers, collapse
 * whitespace, truncate with ellipsis. Self-contained pure helper.
 */
export function plainSnippet(
  contenido: string | undefined,
  max = SNIPPET_MAX,
): string {
  const raw = (contenido || '')
    .replace(/\[\+\[\d+\]\+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 1).trimEnd() + '…';
}

function sortCitations(list: TopicCitation[]): TopicCitation[] {
  return [...list]
    .filter(
      (c) =>
        c &&
        c.documentId &&
        Number.isFinite(c.unitIndex) &&
        c.unitIndex >= 0,
    )
    .sort(
      (a, b) =>
        (b.conf ?? 0) - (a.conf ?? 0) ||
        a.documentId.localeCompare(b.documentId) ||
        a.unitIndex - b.unitIndex,
    );
}

function toCitationRow(
  c: TopicCitation,
  corpus: CorpusService,
): TopicCitationRow {
  const meta = corpus.getMeta(c.documentId);
  const title =
    meta?.title || meta?.shortTitle || c.documentId;
  const num =
    c.consecutivo != null && String(c.consecutivo).trim() !== ''
      ? String(c.consecutivo)
      : String(c.unitIndex);
  return {
    documentId: c.documentId,
    unitIndex: c.unitIndex,
    consecutivo: c.consecutivo,
    conf: c.conf,
    title,
    label: `${title} · Nº ${num}`,
    snippet: `${c.documentId} · índice ${c.unitIndex}`,
  };
}

function resolveRelated(
  topic: TopicRecord,
  catalog: TopicRecord[],
): TopicRecord[] {
  const ids = topic.relatedIds || [];
  if (!ids.length || !catalog?.length) return [];
  const byId = new Map(catalog.map((t) => [t.id, t]));
  const bySlug = new Map(catalog.map((t) => [t.slug, t]));
  const out: TopicRecord[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const t =
      byId.get(id) ||
      bySlug.get(id) ||
      bySlug.get(stripTopicIdToSlug(id)) ||
      null;
    if (!t || t.id === topic.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
