import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { of, Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { StudiesService, Study } from 'src/app/core/account/studies.service';
import {
  catalogDisplayFor,
  CatalogDisplay,
} from 'src/app/core/corpus/catalog.display';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { TopicIndexService } from 'src/app/core/search/topic-index.service';
import { TopicRecord } from 'src/app/core/search/topic-pack.models';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import { environment } from 'src/environments/environment';

type Tab = 'maestros' | 'temas' | 'epocas';

interface TeacherRow {
  id: string;
  name: string;
  meta: string;
  initials: string;
  studyIds: string[];
}

interface EpochRow {
  label: string;
  meta: string;
  docIds: string[];
}

/** Fallback chips when topic pack is empty / feature off → search. */
const FALLBACK_TOPIC_CHIPS = [
  'Fe y razón',
  'Familia',
  'Eucaristía',
  'Esperanza',
  'Caridad',
  'Creación',
];

const FEATURED_ROOT_LIMIT = 12;

@Component({
  standalone: true,
  selector: 'app-explorar',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    WbarComponent,
    BnavComponent,
  ],
  templateUrl: './explorar.component.html',
  styleUrls: ['./explorar.component.css'],
})
export class ExplorarComponent implements OnInit, OnDestroy {
  tab: Tab = 'maestros';
  teachers: TeacherRow[] = [];
  /** Fallback labels only (pack empty / feature off). */
  fallbackTopicChips = FALLBACK_TOPIC_CHIPS;
  epochs: EpochRow[] = [];
  loading = false;

  /** Corpus topic pack (offline). */
  topics: TopicRecord[] = [];
  featuredTopics: TopicRecord[] = [];
  topicFilter = '';
  topicsLoading = false;
  topicsLoaded = false;
  packEmpty = true;

  private topicsLocale: string | null = null;
  private topicsSub: Subscription | null = null;

  constructor(
    private studies: StudiesService,
    private corpus: CorpusService,
    private router: Router,
    private topicIndex: TopicIndexService,
    private readerPrefs: ReaderPreferencesService,
  ) {}

  ngOnInit(): void {
    this.buildEpochsFromCatalog();
    this.ensureTopicsPack();
    if (!environment.apiBaseUrl) {
      this.loadFallbackAuthors();
      return;
    }
    this.loading = true;
    this.studies.listPublished().subscribe({
      next: (items) => {
        this.loading = false;
        this.teachers = this.groupTeachers(items);
        if (!this.teachers.length) this.loadFallbackAuthors();
      },
      error: () => {
        this.loading = false;
        this.loadFallbackAuthors();
      },
    });
  }

  ngOnDestroy(): void {
    this.topicsSub?.unsubscribe();
  }

  /** El catálogo se carga async: espera al manifiesto antes de agrupar autores. */
  private loadFallbackAuthors(): void {
    this.corpus.loadManifest().subscribe(() => {
      this.teachers = this.fallbackAuthors();
    });
  }

  setTab(t: Tab): void {
    this.tab = t;
    if (t === 'temas') this.ensureTopicsPack();
  }

  /**
   * Load offline topic pack for contentLocale once (reload if locale changes).
   * Soft-empty when feature off or assets missing.
   */
  private ensureTopicsPack(): void {
    const locale =
      (this.readerPrefs.resolveContentLocale() || 'es')
        .trim()
        .toLowerCase()
        .split(/[-_]/)[0] || 'es';

    if (
      this.topicsLocale === locale &&
      (this.topicsLoaded || this.topicsLoading)
    ) {
      return;
    }

    this.topicsLocale = locale;
    this.topicsSub?.unsubscribe();
    this.topicsLoading = true;
    this.topicsLoaded = false;

    this.topicsSub = this.topicIndex
      .loadPack(locale)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.topicsLoading = false;
          this.topicsLoaded = true;
        }),
      )
      .subscribe((pack) => {
        const raw = pack?.topics ?? [];
        const seeds = raw
          .filter((t) => !t.kind || t.kind === 'seed')
          .slice()
          .sort((a, b) =>
            (a.label || a.slug).localeCompare(b.label || b.slug, 'es', {
              sensitivity: 'base',
            }),
          );

        this.topics = seeds;
        const roots = seeds.filter(
          (t) => t.parentId == null || t.parentId === undefined,
        );
        this.featuredTopics = (
          roots.length ? roots : seeds
        ).slice(0, FEATURED_ROOT_LIMIT);
        this.packEmpty = seeds.length === 0;
      });
  }

  get filteredFeatured(): TopicRecord[] {
    return this.filterTopics(this.featuredTopics);
  }

  get filteredTopics(): TopicRecord[] {
    return this.filterTopics(this.topics);
  }

  private filterTopics(list: TopicRecord[]): TopicRecord[] {
    const q = (this.topicFilter || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => {
      if ((t.label || '').toLowerCase().includes(q)) return true;
      if ((t.slug || '').toLowerCase().includes(q)) return true;
      return (t.aliases || []).some((a) =>
        (a || '').toLowerCase().includes(q),
      );
    });
  }

  onTopicFilterInput(ev: Event): void {
    const el = ev.target as HTMLInputElement | null;
    this.topicFilter = el?.value ?? '';
  }

  openTopic(t: TopicRecord): void {
    if (!t?.slug) return;
    this.router.navigate(['/explorar/topicos', t.slug]);
  }

  topicMeta(t: TopicRecord): string {
    const parts: string[] = [];
    if (t.unitCount != null && t.unitCount > 0) {
      parts.push(
        `${t.unitCount} cita${t.unitCount === 1 ? '' : 's'}`,
      );
    }
    if (t.documentCount != null && t.documentCount > 0) {
      parts.push(
        `${t.documentCount} doc${t.documentCount === 1 ? '' : 's'}`,
      );
    }
    return parts.join(' · ');
  }

  private groupTeachers(studies: Study[]): TeacherRow[] {
    const map = new Map<string, TeacherRow>();
    for (const s of studies) {
      const t = s.teacher;
      const id = t?.id || s.teacherId || 'unknown';
      const name = t?.name || 'Maestro';
      let row = map.get(id);
      if (!row) {
        row = {
          id,
          name,
          meta: '',
          initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p.charAt(0).toUpperCase())
            .join(''),
          studyIds: [],
        };
        map.set(id, row);
      }
      row.studyIds.push(s.id);
    }
    return [...map.values()].map((r) => ({
      ...r,
      meta: `${r.studyIds.length} estudio${r.studyIds.length === 1 ? '' : 's'} publicado${r.studyIds.length === 1 ? '' : 's'}`,
    }));
  }

  private fallbackAuthors(): TeacherRow[] {
    const authors = new Map<string, { count: number; display: CatalogDisplay }>();
    for (const m of this.corpus.listDocuments()) {
      const d = catalogDisplayFor(m.id, m.kind, {
        author: m.author,
        compiler: m.compiler,
        sourceNote: m.sourceNote,
      });
      const key = d.autor || d.tipo;
      const prev = authors.get(key) || { count: 0, display: d };
      prev.count += 1;
      authors.set(key, prev);
    }
    return [...authors.entries()].map(([name, v]) => ({
      id: name,
      name,
      meta: `${v.count} documento${v.count === 1 ? '' : 's'} en el corpus`,
      initials: name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join(''),
      studyIds: [],
    }));
  }

  private buildEpochsFromCatalog(): void {
    this.corpus.loadManifest().subscribe(() => {
      const buckets: Record<string, string[]> = {
        'Concilio Vaticano II': [],
        Catecismo: [],
        Escritura: [],
        'Padres de la Iglesia': [],
        Otros: [],
      };
      for (const m of this.corpus.listDocuments()) {
        const d = catalogDisplayFor(m.id, m.kind, {
          author: m.author,
          compiler: m.compiler,
          sourceNote: m.sourceNote,
        });
        if (d.tipo.includes('Vaticano')) buckets['Concilio Vaticano II'].push(m.id);
        else if (d.tipo.includes('Catecismo')) buckets['Catecismo'].push(m.id);
        else if (d.tipo.includes('Escritura')) buckets['Escritura'].push(m.id);
        else if (d.tipo.includes('Padres') || m.kind === 'patristic')
          buckets['Padres de la Iglesia'].push(m.id);
        else buckets['Otros'].push(m.id);
      }
      this.epochs = Object.entries(buckets)
        .filter(([, ids]) => ids.length)
        .map(([label, docIds]) => ({
          label,
          meta: `${docIds.length} documento${docIds.length === 1 ? '' : 's'}`,
          docIds,
        }));
    });
  }

  openTeacher(t: TeacherRow): void {
    if (t.studyIds[0]) {
      this.router.navigate(['/estudios', t.studyIds[0]]);
    } else {
      this.router.navigate(['/biblioteca']);
    }
  }

  openEpoch(e: EpochRow): void {
    if (e.docIds[0]) {
      this.router.navigate(['/leyendo', e.docIds[0], 'punto', 0]);
    }
  }

  /** Fallback chip → full-text search. */
  chip(c: string): void {
    this.router.navigate(['/buscar'], { queryParams: { q: c } });
  }
}
