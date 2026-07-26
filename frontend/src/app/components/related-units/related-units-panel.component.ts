import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  RelatedCitationRow,
  suggestRelatedCitations,
  suggestRelatedForDocument,
  suggestRelatedForSaint,
  suggestRelatedForStep,
  ThemeStepSeed,
  toSearchDocumentInput,
} from 'src/app/core/search/semantic-search.logic';
import { DEFAULT_BODY_LOAD_CONCURRENCY } from 'src/app/core/search/search-load.logic';
import { TopicIndexService } from 'src/app/core/search/topic-index.service';
import {
  mergeRelatedByEvidence,
  neighborsFromGraph,
  rowsFromGraphNeighbors,
} from 'src/app/core/search/topic-search.logic';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';

export type RelatedUnitsVariant = 'passage' | 'saint' | 'document';

/**
 * Offline “pasajes relacionados” list (3E-style rows).
 * PR3: merges ref citation graph neighbors with bounded lexical hubs.
 * Loads corpus when needed; degrades to empty list on failure (no crash).
 */
@Component({
  standalone: true,
  selector: 'app-related-units-panel',
  imports: [CommonModule],
  templateUrl: './related-units-panel.component.html',
  styleUrls: ['./related-units-panel.component.css'],
})
export class RelatedUnitsPanelComponent implements OnChanges {
  /** Free-text seed (note body, theme description, document intro…). */
  @Input() seedText: string | null = null;
  /** Prefer step citation: resolves unit body from pack when available. */
  @Input() seedStep: ThemeStepSeed | null = null;
  @Input() limit = 8;
  /** Show “Añadir” control (theme editor). */
  @Input() showAdd = false;
  /** Section heading (handoff .sect). */
  @Input() heading = 'Pasajes relacionados';
  /**
   * `passage` = theme/note neighbors (quality + diversity).
   * `saint` = strict gate for saint covers.
   * `document` = document cover; excludes the whole pack of `excludeDocumentId`.
   */
  @Input() variant: RelatedUnitsVariant = 'passage';
  /** Hide the whole block when there is no seed / no quality hits. */
  @Input() hideWhenEmpty = false;
  /** Soft-boost these pack ids (e.g. saint.documentIds). */
  @Input() preferDocumentIds: string[] | null = null;
  /** Document cover: omit every unit of this pack. */
  @Input() excludeDocumentId: string | null = null;
  /** Override lede; empty string hides it. */
  @Input() lede: string | null = null;

  @Output() addCitation = new EventEmitter<RelatedCitationRow>();
  @Output() openCitation = new EventEmitter<RelatedCitationRow>();

  rows: RelatedCitationRow[] = [];
  loading = false;
  loadError: string | null = null;
  private gen = 0;

  constructor(
    private docs: CargarDocumentosJsonService,
    private nav: NavigationService,
    private readerPrefs: ReaderPreferencesService,
    private topics: TopicIndexService,
  ) {}

  get resolvedLede(): string {
    if (this.lede != null) return this.lede;
    if (this.variant === 'saint') {
      return 'Coincidencias léxicas offline en el corpus (no son citas del santo).';
    }
    if (this.variant === 'document') {
      return 'Pasajes de otras obras del corpus con vocabulario afín (sugerencia offline).';
    }
    return 'Sugeridos offline: citas enlazadas del corpus y pasajes con vocabulario afín.';
  }

  /** Whether the host should render this panel at all. */
  get visible(): boolean {
    const hasSeed = !!(this.seedStep || (this.seedText || '').trim());
    if (!hasSeed) return false;
    if (!this.hideWhenEmpty) return true;
    if (this.loading) return true;
    return this.rows.length > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['seedText'] ||
      changes['seedStep'] ||
      changes['limit'] ||
      changes['variant'] ||
      changes['preferDocumentIds'] ||
      changes['excludeDocumentId']
    ) {
      this.refresh();
    }
  }

  refresh(): void {
    const step = this.seedStep;
    const text = (this.seedText || '').trim();
    if (!step && !text) {
      this.rows = [];
      this.loading = false;
      this.loadError = null;
      return;
    }

    const myGen = ++this.gen;
    this.loading = true;
    this.loadError = null;

    const locale = this.readerPrefs.resolveContentLocale();
    const preferIds = this.preferDocumentIds || [];

    // Load topic pack (graph) + seed doc first, then hubs + graph neighbor docs.
    this.topics
      .loadPack(locale)
      .pipe(
        catchError(() => of(null)),
        switchMap((pack) => {
          const graph = pack?.graph ?? null;
          const seedNeighbors =
            step && graph
              ? neighborsFromGraph(graph, step.documentId, step.unitIndex)
              : [];
          const neighborDocIds = seedNeighbors.map((e) => e.documentId);
          const extraIds = [
            step?.documentId,
            this.excludeDocumentId || undefined,
            ...preferIds,
            ...neighborDocIds,
          ].filter((id): id is string => !!id);

          return this.docs
            .ensureLoadedRelatedPool(locale, {
              extraIds,
              concurrency: DEFAULT_BODY_LOAD_CONCURRENCY,
              isCancelled: () => myGen !== this.gen,
            })
            .pipe(
              map((list) => ({
                list,
                graph,
                seedNeighbors,
              })),
            );
        }),
      )
      .subscribe({
        next: ({ list, graph, seedNeighbors }) => {
          if (myGen !== this.gen) return;
          try {
            const inputs = list.map((d) =>
              toSearchDocumentInput(
                d.id || d.nombre || '',
                d.indice,
                d.documento || [],
              ),
            );

            let lexical: RelatedCitationRow[] = [];
            if (step) {
              lexical = suggestRelatedForStep(step, inputs, {
                limit: this.limit,
                quality: 'passage',
              });
            } else if (text && this.variant === 'saint') {
              lexical = suggestRelatedForSaint(text, inputs, {
                limit: this.limit,
                preferDocumentIds: preferIds.length ? preferIds : undefined,
              });
            } else if (text && this.variant === 'document') {
              lexical = suggestRelatedForDocument(text, inputs, {
                documentId: this.excludeDocumentId || undefined,
                limit: this.limit,
              });
            } else if (text) {
              lexical = suggestRelatedCitations(text, inputs, {
                limit: this.limit,
                quality: 'passage',
                excludeDocumentId: this.excludeDocumentId || undefined,
              });
            }
            // Tag lexical rows for merge.
            lexical = lexical.map((r) => ({
              ...r,
              reason: r.reason || 'lexical',
            }));

            let graphRows: RelatedCitationRow[] = [];
            if (step && seedNeighbors.length) {
              graphRows = rowsFromGraphNeighbors(
                step.documentId,
                step.unitIndex,
                seedNeighbors,
                inputs,
                {
                  excludeDocumentId: this.excludeDocumentId,
                  limit: this.limit,
                },
              ) as RelatedCitationRow[];
            }

            // Saints: keep strict lexical only (graph often points to bible noise).
            if (this.variant === 'saint') {
              this.rows = lexical.slice(0, this.limit);
            } else {
              this.rows = mergeRelatedByEvidence(
                graphRows,
                lexical,
                this.limit,
              ) as RelatedCitationRow[];
            }
          } catch {
            this.rows = [];
            this.loadError = null;
          }
          this.loading = false;
        },
        error: () => {
          if (myGen !== this.gen) return;
          this.rows = [];
          this.loading = false;
          this.loadError = null;
        },
      });
  }

  open(row: RelatedCitationRow): void {
    this.openCitation.emit(row);
    this.nav.navigateToUnit(row.documentId, row.unitIndex, {
      consecutivo: row.consecutivo,
      label: row.title,
    });
  }

  add(ev: Event, row: RelatedCitationRow): void {
    ev.stopPropagation();
    this.addCitation.emit(row);
  }

  /** Optional chrome for reason chip (template may ignore). */
  reasonLabel(row: RelatedCitationRow): string {
    if (row.reason === 'ref') return 'Cita';
    if (row.reason === 'topic') return 'Tema';
    if (row.reason === 'lexical') return 'Texto';
    return '';
  }
}
