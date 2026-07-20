import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import {
  catalogDisplayFor,
  catalogMetaLine,
} from 'src/app/core/corpus/catalog.display';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import {
  LastRead,
  ReadingProgressService,
} from 'src/app/services/reading-progress.service';
import { ROUTE } from 'src/app/services/navigation.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';

/** Orden preferente de pestañas (solo se muestran las presentes). */
const TAB_ORDER = [
  'Concilios',
  'Encíclicas',
  'Catecismo',
  'Escritura',
  'Padres',
  'Otros',
];

const TAB_BY_TIPO: Record<string, string> = {
  'Concilio Vaticano II': 'Concilios',
  Encíclica: 'Encíclicas',
  Exhortación: 'Encíclicas',
  Catecismo: 'Catecismo',
  'Sagrada Escritura': 'Escritura',
  'Padres de la Iglesia': 'Padres',
};

/** Pantalla 3D · Biblioteca + 5B web. */
@Component({
  standalone: true,
  selector: 'app-list-documents-pages',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent implements OnInit, OnDestroy {
  query = '';
  activeTab = 'Todos';
  loading = false;
  load_error: string | null = null;
  lastRead: LastRead | null = null;

  private sub = new Subscription();
  /** Tick so labels re-resolve when UI locale changes. */
  localeTick = 0;

  constructor(
    public docService: CargarDocumentosJsonService,
    private router: Router,
    private corpus: CorpusService,
    private progress: ReadingProgressService,
    private readerPrefs: ReaderPreferencesService,
    public i18n: UiI18nService,
  ) {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  t(key: string, params?: Record<string, string | number>): string {
    void this.localeTick;
    return this.i18n.t(key, params);
  }

  ngOnInit(): void {
    this.lastRead = this.progress.getLastRead();
    this.loading = true;
    this.sub.add(
      this.readerPrefs.prefs$.subscribe(() => {
        /* recompute catalog preferred locale via getters */
      }),
    );
    this.sub.add(
      this.docService.ensureAllLoaded().subscribe({
        next: () => {
          this.loading = false;
          this.load_error = null;
        },
        error: (err) => {
          this.loading = false;
          this.load_error =
            err?.message ?? 'No se pudieron cargar los documentos.';
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Editions preferred by content locale (one row per multi-lang work). */
  private catalogItems(): IndiceDocumentos[] {
    const all = this.docService.documentos_disponibles || [];
    if (!all.length) return [];
    const preferredLocale = this.readerPrefs.resolveContentLocale();
    const preferredIds = new Set(
      this.corpus.listCatalogDocuments(preferredLocale).map((m) => m.id),
    );
    // Keep IndiceDocumentos shape (loaded bodies) for preferred ids only.
    const byId = new Map(all.map((d) => [d.id || d.nombre, d]));
    const out: IndiceDocumentos[] = [];
    for (const id of preferredIds) {
      const hit = byId.get(id);
      if (hit) out.push(hit);
    }
    // Fallback: if ensureAllLoaded not fully mirrored, still list preferred metas
    if (!out.length) {
      return all;
    }
    return out;
  }

  get tabs(): string[] {
    const present = new Set<string>();
    for (const item of this.catalogItems()) {
      present.add(this.tabOf(item));
    }
    return ['Todos', ...TAB_ORDER.filter((t) => present.has(t))];
  }

  /** 5B sidebar labels closer to design (tipo completo cuando existe). */
  get sideTabs(): string[] {
    return this.tabs;
  }

  get filtered(): IndiceDocumentos[] {
    const all = this.catalogItems();
    const q = this.query.trim().toLowerCase();
    return all.filter((item) => {
      if (this.activeTab !== 'Todos' && this.tabOf(item) !== this.activeTab) {
        return false;
      }
      if (!q) return true;
      const title = this.displayTitle(item).toLowerCase();
      const meta = this.metaLine(item).toLowerCase();
      const short = (item.shortTitle || '').toLowerCase();
      const langs = (this.langsLine(item) || '').toLowerCase();
      return (
        title.includes(q) ||
        meta.includes(q) ||
        short.includes(q) ||
        langs.includes(q)
      );
    });
  }

  get docCount(): number {
    return this.catalogItems().length;
  }

  get lastReadLabel(): string {
    if (!this.lastRead) return '';
    const meta = this.corpus.getMeta(this.lastRead.documentId);
    const short =
      meta?.shortTitle ||
      this.lastRead.label ||
      this.lastRead.documentId;
    return `${short} ${this.lastRead.unitIndex + 1}`;
  }

  get sinResultados(): boolean {
    return (
      !this.loading &&
      !this.load_error &&
      (this.docService.documentos_disponibles?.length || 0) > 0 &&
      this.filtered.length === 0
    );
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  onQuery(ev: Event): void {
    this.query = (ev.target as HTMLInputElement).value;
  }

  displayTitle(item: IndiceDocumentos): string {
    return (
      item.title ||
      item.nombre ||
      this.corpus.getMeta(item.id || '')?.title ||
      item.id ||
      'Documento'
    );
  }

  metaLine(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    const base = catalogMetaLine(
      catalogDisplayFor(item.id, meta?.kind, {
        author: meta?.author,
        compiler: meta?.compiler,
        sourceNote: meta?.sourceNote,
      })
    );
    const langs = this.langsLine(item);
    return langs ? `${base} · ${langs}` : base;
  }

  /** Subtítulo de idiomas cuando la obra tiene más de una edición. */
  langsLine(item: IndiceDocumentos): string | null {
    return this.corpus.multiLocaleLabel(item.id || '');
  }

  kindOf(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    const d = catalogDisplayFor(item.id, meta?.kind, {
      author: meta?.author,
      compiler: meta?.compiler,
      sourceNote: meta?.sourceNote,
    });
    // Compact kind for bookcard badge
    if (d.tipo.startsWith('Concilio')) return 'Concilio';
    return d.tipo;
  }

  progressOf(item: IndiceDocumentos): number | null {
    if (!this.lastRead || this.lastRead.documentId !== (item.id || item.nombre)) {
      return null;
    }
    const pct = this.progress.percent(this.lastRead);
    return pct > 0 ? pct : null;
  }

  goContinue(): void {
    if (!this.lastRead) {
      return;
    }
    this.router.navigate([
      ROUTE.leyendo,
      this.lastRead.documentId,
      ROUTE.punto,
      this.lastRead.unitIndex,
    ]);
  }

  /** Flujo del diseño: Biblioteca → Detalle (2A/5C), no directo al lector. */
  open(item: IndiceDocumentos): void {
    this.router.navigate(['/documento', item.id ?? item.nombre]);
  }

  private tabOf(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    const tipo = catalogDisplayFor(item.id, meta?.kind, {
      author: meta?.author,
      compiler: meta?.compiler,
      sourceNote: meta?.sourceNote,
    }).tipo;
    return TAB_BY_TIPO[tipo] || 'Otros';
  }
}
