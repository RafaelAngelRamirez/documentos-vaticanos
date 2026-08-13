import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { DocumentMeta } from 'src/app/core/corpus/corpus.models';
import {
  CatalogDisplay,
  catalogDisplayFor,
} from 'src/app/core/corpus/catalog.display';
import {
  localeProvenanceBadge,
  isAiEdition,
  localeLabel,
} from 'src/app/core/corpus/document-locale.logic';
import { NavigationService } from 'src/app/services/navigation.service';
import { resolveCoverReadingIndex } from 'src/app/services/open-reading.logic';
import {
  LastRead,
  ReadingProgressService,
} from 'src/app/services/reading-progress.service';
import {
  buildDocumentToc,
  TocEntry,
} from 'src/app/services/document-toc.logic';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
import { RelatedUnitsPanelComponent } from 'src/app/components/related-units/related-units-panel.component';
import {
  MetaGridCell,
  ReadingCoverComponent,
} from 'src/app/components/reading-cover';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { HistoricalContextService } from 'src/app/core/context/historical-context.service';
import { ResolvedHistoricalContext } from 'src/app/core/context/historical-context.models';
import { relatedSeedForDocument } from 'src/app/core/search/semantic-search.logic';

const FAVS_KEY = 'dv.favs';

/** Pantalla 2A · Detalle del documento + 5C web (via app-reading-cover). */
@Component({
  standalone: true,
  selector: 'app-documento-detalle',
  imports: [
    CommonModule,
    RouterModule,
    WbarComponent,
    HistoricalContextBlockComponent,
    RelatedUnitsPanelComponent,
    ReadingCoverComponent,
  ],
  templateUrl: './documento-detalle.component.html',
  styleUrls: ['./documento-detalle.component.css'],
})
export class DocumentoDetalleComponent implements OnInit, OnDestroy {
  docId = '';
  meta: DocumentMeta | undefined;
  display: CatalogDisplay = { tipo: 'Documento' };
  lastRead: LastRead | null = null;
  fav = false;
  loading = true;
  error: string | null = null;
  /**
   * Índice de navegación (`.toc`): landmarks from corpus units
   * (`buildDocumentToc`) with stable `unitIndex` jump targets.
   */
  chapters: TocEntry[] = [];
  /** Santo / autor relacionado (santoral offline). */
  relatedSaint: SaintRecord | null = null;
  /** Otras obras del mismo santo (sin el doc actual). */
  siblingWorks: { documentId: string; title: string }[] = [];
  /** Contexto histórico offline (general + obra). */
  historicalContext: ResolvedHistoricalContext | null = null;
  /** Ediciones de la misma obra en otros idiomas (incluye la actual). */
  languageEditions: DocumentMeta[] = [];
  /** Quality-gated seed for cross-pack related units (empty → panel hidden). */
  relatedSeed = '';

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private corpus: CorpusService,
    private navigationService: NavigationService,
    private progress: ReadingProgressService,
    private santoral: SantoralService,
    private historical: HistoricalContextService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.route.paramMap.subscribe((pm) => {
        this.docId = pm.get('id') || '';
        this.cargar();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get kindLine(): string {
    const parts = [this.display.tipo];
    if (this.display.anio) parts.push(String(this.display.anio));
    return parts.join(' · ');
  }

  get unidadesLabel(): string {
    const n = this.meta?.unitCount;
    if (!n) return '—';
    const unidad = this.meta?.kind === 'bible' ? 'versículos' : 'numerales';
    return `${n.toLocaleString('es')} ${unidad}`;
  }

  /** Unified meta grid (2A + 5C). */
  get metaCells(): MetaGridCell[] {
    return [
      { key: 'Autor', value: this.display.autor || '—' },
      { key: 'Fecha', value: this.fechaLabel },
      { key: 'Contenido', value: this.unidadesLabel },
      { key: 'Lectura', value: this.lecturaEstimada },
    ];
  }

  private get fechaLabel(): string {
    const a = this.display.anio;
    if (a == null || a === undefined) return '—';
    return String(a);
  }

  get tocEmptyHint(): string {
    return `${this.unidadesLabel} · abra el lector para navegar por unidades.`;
  }

  /** Estimación aproximada: ~1,1 min por numeral; versículos más breves. */
  get lecturaEstimada(): string {
    const n = this.meta?.unitCount || 0;
    if (!n) return '—';
    const minPorUnidad = this.meta?.kind === 'bible' ? 0.15 : 1.1;
    const total = Math.round(n * minPorUnidad);
    if (total < 60) return `≈ ${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`;
  }

  get puedeContinuar(): boolean {
    return !!this.lastRead && this.lastRead.unitIndex > 0;
  }

  get posicionLabel(): string {
    if (!this.lastRead || !this.meta?.unitCount) return '';
    return `Última posición: unidad ${this.lastRead.unitIndex + 1} de ${
      this.meta.unitCount
    }`;
  }

  get showLanguageSwitcher(): boolean {
    return this.languageEditions.length > 1;
  }

  get fuenteLangLabel(): string {
    return localeLabel(this.meta?.locale);
  }

  langLabel(ed: DocumentMeta): string {
    const badge = localeProvenanceBadge(ed.locale, isAiEdition(ed));
    // Full name for accessibility; AI packs show e.g. "English · EN(AI)"
    const base = localeLabel(ed.locale);
    return isAiEdition(ed) ? `${base} · ${badge}` : base;
  }

  langBadge(ed: DocumentMeta): string {
    return localeProvenanceBadge(ed.locale, isAiEdition(ed));
  }

  isCurrentLang(ed: DocumentMeta): boolean {
    return ed.id === this.docId;
  }

  /** Cambia al pack hermano (misma obra, otro idioma). */
  selectLanguage(ed: DocumentMeta): void {
    if (!ed?.id || ed.id === this.docId) return;
    this.router.navigate(['/documento', ed.id]);
  }

  comenzar(): void {
    this.irALector(
      resolveCoverReadingIndex(this.puedeContinuar, this.lastRead?.unitIndex),
    );
  }

  /** Jump from Índice row → reader at that unit (offline, no API). */
  openChapter(entry: TocEntry): void {
    if (!entry || typeof entry.unitIndex !== 'number') return;
    this.irALector(entry.unitIndex);
  }

  /** 2A/5C: misma entrada al lector; el narrador se activa en 5D. */
  comenzarNarrador(): void {
    this.irALector(
      resolveCoverReadingIndex(this.puedeContinuar, this.lastRead?.unitIndex),
      { autoNarr: true },
    );
  }

  reiniciar(): void {
    this.irALector(0);
  }

  toggleFav(): void {
    if (!this.meta) return;
    const favs = this.leerFavs();
    const idx = favs.indexOf(this.meta.id);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(this.meta.id);
    this.fav = idx < 0;
    try {
      localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    } catch {
      // Ignorar fallos de cuota / modo privado.
    }
  }

  volver(): void {
    this.router.navigate(['/biblioteca']);
  }

  private cargar(): void {
    this.loading = true;
    this.error = null;
    this.chapters = [];
    this.relatedSaint = null;
    this.siblingWorks = [];
    this.historicalContext = null;
    this.languageEditions = [];
    this.relatedSeed = '';
    this.sub.add(
      this.corpus.loadManifest().subscribe({
        next: () => {
          this.meta = this.corpus.getMeta(this.docId);
          if (!this.meta) {
            this.error = `Documento no encontrado: ${this.docId}`;
            this.loading = false;
            return;
          }
          this.languageEditions = this.corpus.editionsOf(this.meta.id);
          this.display = catalogDisplayFor(this.meta.id, this.meta.kind, {
            author: this.meta.author,
            compiler: this.meta.compiler,
            sourceNote: this.meta.sourceNote,
          });
          const last = this.progress.getLastRead();
          this.lastRead =
            last && last.documentId === this.meta.id ? last : null;
          this.fav = this.leerFavs().includes(this.meta.id);
          this.cargarReferenciasSantoral();
          this.cargarContextoHistorico();
          // Cover from manifest; body/TOC load in the background (this pack only).
          this.loading = false;
          this.sub.add(
            this.corpus.ensureLoaded(this.meta.id).subscribe({
              next: (loaded) => {
                this.chapters = buildDocumentToc(loaded.documento, {
                  documentId: this.meta!.id,
                  kind: this.meta!.kind,
                });
                this.relatedSeed = relatedSeedForDocument(
                  this.meta!,
                  loaded.documento || [],
                );
              },
              error: () => {
                // Manifest ok but body failed — still show cover; empty index.
                this.chapters = [];
                this.relatedSeed = relatedSeedForDocument(this.meta!, []);
              },
            })
          );
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.message ?? 'No se pudo cargar el catálogo.';
        },
      })
    );
  }

  /** Contexto histórico offline (no bloquea el lector si falla). */
  private cargarContextoHistorico(): void {
    if (!this.meta) return;
    const id = this.meta.id;
    this.sub.add(
      this.historical.contextForDocument(id).subscribe({
        next: (ctx) => {
          this.historicalContext = ctx;
        },
        error: () => {
          this.historicalContext = null;
        },
      }),
    );
  }

  /** Referencias de menú: santo autor + obras hermanas del corpus. */
  private cargarReferenciasSantoral(): void {
    if (!this.meta) return;
    const meta = this.meta;
    this.sub.add(
      this.santoral.loadManifest().subscribe({
        next: () => {
          this.relatedSaint =
            this.santoral.saintForDoc(meta.id, meta.author) || null;
          this.siblingWorks = this.relatedSaint
            ? this.santoral.siblingsForDoc(meta.id, meta.author).slice(0, 12)
            : [];
        },
        error: () => {
          this.relatedSaint = null;
          this.siblingWorks = [];
        },
      }),
    );
  }

  saintLabel(): string {
    if (!this.relatedSaint) return '';
    return this.relatedSaint.displayName || this.relatedSaint.name;
  }

  private irALector(idx: number, opts?: { autoNarr?: boolean }): void {
    if (!this.meta) return;
    this.navigationService.openReading(this.meta.id, {
      unitIndex: idx,
      autoNarr: opts?.autoNarr,
    });
  }

  private leerFavs(): string[] {
    try {
      const raw = localStorage.getItem(FAVS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
