import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
import { PasajeComponent } from 'src/app/components/pasaje/pasaje.component';
import { ReadingCtasComponent } from 'src/app/components/reading-cover';
import {
  PersonFichaComponent,
  PersonWorkLink,
} from 'src/app/components/person-ficha/person-ficha.component';
import { Padre, padreById } from 'src/app/data/padres';
import { HistoricalContextService } from 'src/app/core/context/historical-context.service';
import { ResolvedHistoricalContext } from 'src/app/core/context/historical-context.models';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { citedDownloadCaption } from 'src/app/core/corpus/download-progress.logic';
import { CitedVerse } from 'src/app/core/liturgia/bible-cite.logic';
import { primaryWorkDocumentId } from 'src/app/core/person/person-reading.logic';
import {
  citedPassageForPatristic,
  parsePatristicCite,
} from 'src/app/core/reading/patristic-cite.logic';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  documentIdKey,
  parseDocumentId,
  resumeUnitFor,
} from 'src/app/core/reading/cite';

/** Diseño 2D · Detalle de un Padre */
@Component({
  standalone: true,
  selector: 'app-padre-detalle',
  imports: [
    CommonModule,
    RouterModule,
    PersonFichaComponent,
    HistoricalContextBlockComponent,
    PasajeComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './padre-detalle.component.html',
  styleUrls: ['./padre-detalle.component.css'],
})
export class PadreDetalleComponent implements OnInit, OnDestroy {
  padre: Padre | null = null;
  historicalContext: ResolvedHistoricalContext | null = null;
  works: PersonWorkLink[] = [];
  /** Quote source that parses as one NPNF (or other packed) citation. */
  quoteCite = '';
  pasajeVerses: CitedVerse[] = [];
  pasajeLabel = '';
  citeStatus = '';
  private citeToken = 0;
  private citeBusy = false;
  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private historical: HistoricalContextService,
    private navigation: NavigationService,
    private corpus: CorpusService,
  ) {}

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /**
   * Opens only the paragraph the citation names (shared patristic door).
   * The BAC volume stays closed. The URL stays on the ficha.
   */
  openCite(label: string): void {
    const parsed = parsePatristicCite(label);
    if (!parsed) return;
    const token = ++this.citeToken;
    this.citeBusy = true;
    this.citeStatus = 'Descargando…';
    this.sub.add(
      this.corpus.ensureLoaded(parsed.documentId).subscribe({
        next: (doc) => {
          if (token !== this.citeToken) return;
          this.citeBusy = false;
          this.citeStatus = '';
          const passage = citedPassageForPatristic(parsed, doc.documento);
          this.pasajeLabel = label;
          this.pasajeVerses = passage?.verses ?? [];
          this.focusPasaje();
        },
        error: () => {
          if (token !== this.citeToken) return;
          this.citeBusy = false;
          this.citeStatus = '';
        },
      }),
    );
  }

  private focusPasaje(): void {
    setTimeout(() => {
      document
        .querySelector(
          '[data-testid="padre-pasaje"], [data-testid="padre-cite-progress"]',
        )
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.padre = padreById(id) || null;
    if (!this.padre) {
      this.router.navigate(['/padres']);
      return;
    }
    const quote = (this.padre.quoteSource || '').trim();
    this.quoteCite = quote && parsePatristicCite(quote) ? quote : '';
    this.works = (this.padre.works || []).map((w) => ({
      title: w.title,
      documentId: w.documentId,
      citeLabel: w.citeLabel,
    }));
    this.sub.add(
      this.corpus.downloadProgress$.subscribe((progress) => {
        if (!this.citeBusy) return;
        this.citeStatus = citedDownloadCaption(progress);
      }),
    );
    // Same offline author profiles as santoral when ids align (e.g. agustin-hipona).
    this.sub.add(
      this.historical.contextForSaint(this.padre.id).subscribe({
        next: (ctx) => {
          this.historicalContext = ctx;
        },
        error: () => {
          this.historicalContext = null;
        },
      }),
    );
  }

  get kindLine(): string {
    if (!this.padre) return '';
    return [this.padre.eraLabel, this.padre.years].filter(Boolean).join(' · ');
  }

  get primaryWorkId(): string | null {
    return primaryWorkDocumentId(this.works);
  }

  openPrimaryWork(autoNarr = false): void {
    const id = parseDocumentId(this.primaryWorkId);
    if (!id) return;
    this.navigation.openReading(documentIdKey(id), {
      unitIndex: resumeUnitFor(this.navigation.resume(), id),
      autoNarr,
    });
  }
}
