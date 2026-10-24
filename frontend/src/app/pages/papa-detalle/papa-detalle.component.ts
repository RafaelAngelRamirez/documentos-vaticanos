import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
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
import { PapacyService } from 'src/app/core/papacy/papacy.service';
import {
  GENRE_LABEL_ES,
  pendingWorks,
} from 'src/app/core/papacy/papacy-resolve.logic';
import {
  PapalDocumentGenre,
  PapalWorkRef,
  PopeRecord,
} from 'src/app/core/papacy/papacy.models';
import {
  canContinuePopeReading,
  popeDocumentId,
  popeToReadingDocument,
} from 'src/app/core/papacy/papacy-units.logic';
import { tocFromSaintUnits } from 'src/app/core/santoral/santoral-units.logic';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { HistoricalContextService } from 'src/app/core/context/historical-context.service';
import { ResolvedHistoricalContext } from 'src/app/core/context/historical-context.models';
import { NavigationService } from 'src/app/services/navigation.service';
import { resolveCoverReadingIndex } from 'src/app/services/open-reading.logic';
import {
  LastRead,
  ReadingProgressService,
} from 'src/app/services/reading-progress.service';
import { TocEntry } from 'src/app/services/document-toc.logic';

/** Ficha de pontífice (plantilla 2D / 2A): vida, santoral, obras, catálogo vatican.va. */
@Component({
  standalone: true,
  selector: 'app-papa-detalle',
  imports: [
    CommonModule,
    RouterModule,
    PersonFichaComponent,
    HistoricalContextBlockComponent,
    MetaGridComponent,
    DocTocComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './papa-detalle.component.html',
  styleUrls: ['./papa-detalle.component.css'],
})
export class PapaDetalleComponent implements OnInit {
  pope: PopeRecord | null = null;
  works: PersonWorkLink[] = [];
  catalog: PapalWorkRef[] = [];
  loading = true;
  historicalContext: ResolvedHistoricalContext | null = null;
  readingDocId = '';
  lastRead: LastRead | null = null;
  unitCount = 0;
  chapters: TocEntry[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private papacy: PapacyService,
    private corpus: CorpusService,
    private historical: HistoricalContextService,
    private progress: ReadingProgressService,
    private navigationService: NavigationService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.corpus.loadManifest().subscribe({
      next: () => {
        this.papacy.loadManifest().subscribe({
          next: () => {
            this.pope = this.papacy.getPope(id) || null;
            if (!this.pope) {
              this.router.navigate(['/papas']);
              return;
            }
            this.works = this.papacy.worksForPope(this.pope).map((w) => ({
              title: w.title,
              documentId: w.documentId,
            }));
            this.catalog = pendingWorks(this.pope);
            this.readingDocId = popeDocumentId(this.pope.id);
            const built = popeToReadingDocument(this.pope);
            this.unitCount = built?.meta.unitCount ?? 0;
            this.chapters = built
              ? (tocFromSaintUnits(built.documento, 20) as TocEntry[])
              : [];
            const last = this.progress.getLastRead();
            this.lastRead =
              last && last.documentId === this.readingDocId ? last : null;
            this.papacy.loadReadingDocumentForPope(this.pope).subscribe({
              error: () => {
                /* cover still usable */
              },
            });
            this.loading = false;
            const ctxId = this.pope.saintId || this.pope.id;
            this.historical.contextForSaint(ctxId).subscribe({
              next: (ctx) => {
                this.historicalContext = ctx;
              },
              error: () => {
                this.historicalContext = null;
              },
            });
          },
          error: () => this.router.navigate(['/papas']),
        });
      },
      error: () => this.router.navigate(['/papas']),
    });
  }

  get title(): string {
    return this.pope?.displayName || this.pope?.name || '';
  }

  get kindLine(): string {
    if (!this.pope) return '';
    const honor =
      this.pope.honor === 'blessed'
        ? 'Beato'
        : this.pope.honor === 'saint'
          ? 'Santo'
          : '';
    return [honor, `${this.pope.ordinal}º papa`, this.pope.years]
      .filter(Boolean)
      .join(' · ');
  }

  get subtitle(): string {
    if (!this.pope) return '';
    return [this.pope.secularName, this.pope.birthplace, this.pope.see]
      .filter(Boolean)
      .join(' · ');
  }

  get hasBio(): boolean {
    return !!(this.pope?.bio && this.pope.bio.trim().length > 0);
  }

  get puedeContinuar(): boolean {
    if (!this.pope) return false;
    return canContinuePopeReading(this.lastRead, this.pope.id);
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
    const total = Math.max(1, Math.round(this.unitCount * 0.4));
    if (total < 60) return `≈ ${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`;
  }

  get metaCells(): MetaGridCell[] {
    if (!this.hasBio) return [];
    const cells: MetaGridCell[] = [
      { key: 'Contenido', value: this.unidadesLabel },
      { key: 'Lectura', value: this.lecturaEstimada },
    ];
    if (this.pope?.see) cells.push({ key: 'Sede', value: this.pope.see });
    return cells;
  }

  genreLabel(g?: PapalDocumentGenre | string): string {
    if (!g) return 'Documento';
    return GENRE_LABEL_ES[g as PapalDocumentGenre] || g;
  }

  groupedCatalog(): { genre: string; items: PapalWorkRef[]; extra: number }[] {
    const map = new Map<string, PapalWorkRef[]>();
    for (const w of this.catalog) {
      const g = this.genreLabel(w.genre);
      const arr = map.get(g) || [];
      arr.push(w);
      map.set(g, arr);
    }
    return Array.from(map.entries()).map(([genre, items]) => ({
      genre,
      items: items.slice(0, 40),
      extra: Math.max(0, items.length - 40),
    }));
  }

  comenzar(): void {
    this.irALector(
      resolveCoverReadingIndex(this.puedeContinuar, this.lastRead?.unitIndex),
    );
  }

  reiniciar(): void {
    this.irALector(0);
  }

  openChapter(entry: TocEntry): void {
    if (!entry || typeof entry.unitIndex !== 'number') return;
    this.irALector(entry.unitIndex);
  }

  comenzarNarrador(): void {
    this.irALector(
      resolveCoverReadingIndex(this.puedeContinuar, this.lastRead?.unitIndex),
      { autoNarr: true },
    );
  }

  private irALector(idx: number, opts?: { autoNarr?: boolean }): void {
    if (!this.pope || !this.readingDocId) return;
    this.navigationService.openReading(this.readingDocId, {
      unitIndex: idx,
      autoNarr: opts?.autoNarr,
    });
  }
}
