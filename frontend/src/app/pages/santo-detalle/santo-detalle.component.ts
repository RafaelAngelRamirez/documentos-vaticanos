import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
import { RelatedUnitsPanelComponent } from 'src/app/components/related-units/related-units-panel.component';
import {
  DocTocComponent,
  MetaGridCell,
  MetaGridComponent,
  ReadingCtasComponent,
} from 'src/app/components/reading-cover';
import {
  PersonFichaComponent,
  PersonWorkLink,
} from 'src/app/components/person-ficha/person-ficha.component';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import {
  canContinueSaintReading,
  relatedSeedForSaint,
  saintDocumentId,
  saintToReadingDocument,
  tocFromSaintUnits,
} from 'src/app/core/santoral/santoral-units.logic';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { HistoricalContextService } from 'src/app/core/context/historical-context.service';
import { ResolvedHistoricalContext } from 'src/app/core/context/historical-context.models';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  LastRead,
  ReadingProgressService,
} from 'src/app/services/reading-progress.service';
import { TocEntry } from 'src/app/services/document-toc.logic';

/** Detalle de un santo: portada 2A-like → lector + temas + relacionados + obras. */
@Component({
  standalone: true,
  selector: 'app-santo-detalle',
  imports: [
    CommonModule,
    RouterModule,
    PersonFichaComponent,
    HistoricalContextBlockComponent,
    RelatedUnitsPanelComponent,
    MetaGridComponent,
    DocTocComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './santo-detalle.component.html',
  styleUrls: ['./santo-detalle.component.css'],
})
export class SantoDetalleComponent implements OnInit {
  saint: SaintRecord | null = null;
  works: PersonWorkLink[] = [];
  loading = true;
  /** Perfil histórico del autor (pack context offline). */
  historicalContext: ResolvedHistoricalContext | null = null;
  /** Synthetic reading document id (`santoral:{id}`). */
  readingDocId = '';
  lastRead: LastRead | null = null;
  unitCount = 0;
  /** Índice de la biografía (unidades estables). */
  chapters: TocEntry[] = [];
  /** Seed for related-units panel (offline semantic). */
  relatedSeed = '';
  /** Soft-boost corpus works linked to this saint (if any). */
  relatedPreferDocIds: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private santoral: SantoralService,
    private corpus: CorpusService,
    private historical: HistoricalContextService,
    private progress: ReadingProgressService,
    private navigationService: NavigationService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.corpus.loadManifest().subscribe({
      next: () => {
        this.santoral.loadManifest().subscribe({
          next: () => {
            this.saint = this.santoral.getSaint(id) || null;
            if (!this.saint) {
              this.router.navigate(['/santoral']);
              return;
            }
            this.works = this.santoral.worksForSaint(this.saint).map((w) => ({
              title: w.title,
              documentId: w.documentId,
            }));
            this.readingDocId = saintDocumentId(this.saint.id);
            const built = saintToReadingDocument(this.saint);
            this.unitCount = built?.meta.unitCount ?? 0;
            this.chapters = built
              ? tocFromSaintUnits(built.documento, 20)
              : [];
            this.relatedSeed = relatedSeedForSaint(this.saint);
            this.relatedPreferDocIds = Array.isArray(this.saint.documentIds)
              ? this.saint.documentIds.filter(Boolean)
              : [];
            const last = this.progress.getLastRead();
            this.lastRead =
              last && last.documentId === this.readingDocId ? last : null;
            // Preload into reader cache (offline; non-blocking if fails).
            this.santoral.loadReadingDocumentForSaint(this.saint).subscribe({
              error: () => {
                /* cover still usable; lector will retry */
              },
            });
            this.loading = false;
            this.historical.contextForSaint(this.saint.id).subscribe({
              next: (ctx) => {
                this.historicalContext = ctx;
              },
              error: () => {
                this.historicalContext = null;
              },
            });
          },
          error: () => {
            this.router.navigate(['/santoral']);
          },
        });
      },
      error: () => this.router.navigate(['/santoral']),
    });
  }

  get title(): string {
    return this.saint?.displayName || this.saint?.name || '';
  }

  get kindLine(): string {
    if (!this.saint) return '';
    const parts = [this.saint.eraLabel || this.saint.era, this.saint.years].filter(
      Boolean,
    );
    return parts.join(' · ');
  }

  get puedeContinuar(): boolean {
    if (!this.saint) return false;
    return canContinueSaintReading(this.lastRead, this.saint.id);
  }

  get posicionLabel(): string {
    if (!this.lastRead || !this.unitCount) return '';
    return `Última posición: unidad ${this.lastRead.unitIndex + 1} de ${
      this.unitCount
    }`;
  }

  get unidadesLabel(): string {
    if (!this.unitCount) return '—';
    const n = this.unitCount;
    return `${n.toLocaleString('es')} ${n === 1 ? 'párrafo' : 'párrafos'}`;
  }

  get lecturaEstimada(): string {
    if (!this.unitCount) return '—';
    // ~0.4 min per biography paragraph
    const total = Math.max(1, Math.round(this.unitCount * 0.4));
    if (total < 60) return `≈ ${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`;
  }

  get metaCells(): MetaGridCell[] {
    if (!this.hasBio) return [];
    return [
      { key: 'Contenido', value: this.unidadesLabel },
      { key: 'Lectura', value: this.lecturaEstimada },
    ];
  }

  get hasBio(): boolean {
    return !!(this.saint?.bio && this.saint.bio.trim().length > 0);
  }

  comenzar(): void {
    const idx = this.puedeContinuar ? this.lastRead!.unitIndex : 0;
    this.irALector(idx);
  }

  reiniciar(): void {
    this.irALector(0);
  }

  openChapter(entry: TocEntry): void {
    if (!entry || typeof entry.unitIndex !== 'number') return;
    this.irALector(entry.unitIndex);
  }

  /** Same as 2A/5C document cover: auto-start narrator in lector. */
  comenzarNarrador(): void {
    const idx = this.puedeContinuar ? this.lastRead!.unitIndex : 0;
    this.irALector(idx, { autoNarr: true });
  }

  openTheme(theme: string): void {
    const q = (theme || '').trim();
    if (!q) return;
    this.router.navigate(['/buscar'], { queryParams: { q } });
  }

  openDoc(documentId: string): void {
    this.router.navigate(['/documento', documentId]);
  }

  private irALector(idx: number, opts?: { autoNarr?: boolean }): void {
    if (!this.saint || !this.readingDocId) return;
    this.navigationService.openReading(this.readingDocId, {
      unitIndex: idx,
      autoNarr: opts?.autoNarr,
    });
  }
}
