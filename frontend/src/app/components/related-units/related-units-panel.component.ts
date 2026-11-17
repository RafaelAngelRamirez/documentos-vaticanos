import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
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
  neighborsInLoadedPool,
  rowsFromGraphNeighbors,
} from 'src/app/core/search/topic-search.logic';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
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
export class RelatedUnitsPanelComponent implements OnChanges, OnDestroy {
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
  /**
   * Open paragraph: omit this unit only. The rest of the pack can still match.
   * The pack id is added to the hub pool as one extra document, not a higher cap.
   */
  @Input() excludeUnitDocumentId: string | null = null;
  @Input() excludeUnitIndex: number | null = null;
  /**
   * Mix unit-graph neighbors that are already in the loaded pool.
   * Does not fetch neighbor packs outside that pool.
   */
  @Input() graphWithinPool = false;
  /** `push` records the current cite so back returns to it. Cover stays `keep`. */
  @Input() openStack: 'keep' | 'push' = 'keep';
  /** Override lede; empty string hides it. */
  @Input() lede: string | null = null;

  @Output() addCitation = new EventEmitter<RelatedCitationRow>();
  @Output() openCitation = new EventEmitter<RelatedCitationRow>();

  rows: RelatedCitationRow[] = [];
  loading = false;
  loadError: string | null = null;
  private gen = 0;

  constructor(
    private docs: CorpusService,
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
      changes['excludeDocumentId'] ||
      changes['excludeUnitDocumentId'] ||
      changes['excludeUnitIndex'] ||
      changes['graphWithinPool']
    ) {
      this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.gen += 1;
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
      .loadGraphs(locale)
      .pipe(
        catchError(() => of(null)),
        switchMap((pack) => {
          const graph = pack?.graph ?? null;
          const unitExclude = this.unitExclude();
          const graphSeed = step
            ? { documentId: step.documentId, unitIndex: step.unitIndex }
            : this.graphWithinPool && unitExclude
              ? unitExclude
              : null;
          const seedNeighbors =
            graphSeed && graph
              ? neighborsFromGraph(
                  graph,
                  graphSeed.documentId,
                  graphSeed.unitIndex,
                )
              : [];
          // Theme steps may load neighbor packs. The open paragraph does not:
          // a citation outside the hub pool is omitted.
          const neighborDocIds =
            step && !this.graphWithinPool
              ? seedNeighbors.map((e) => e.documentId)
              : [];
          const extraIds = [
            step?.documentId,
            this.excludeDocumentId || undefined,
            unitExclude?.documentId,
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
                seedNeighbors,
              })),
            );
        }),
      )
      .subscribe({
        next: ({ list, seedNeighbors }) => {
          if (myGen !== this.gen) return;
          try {
            const inputs = list.map((d) =>
              toSearchDocumentInput(
                d.id || d.nombre || '',
                d.indice,
                d.documento || [],
              ),
            );

            const unitExclude = this.unitExclude();
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
            } else if (text && this.variant === 'document' && !unitExclude) {
              lexical = suggestRelatedForDocument(text, inputs, {
                documentId: this.excludeDocumentId || undefined,
                limit: this.limit,
              });
            } else if (text) {
              lexical = suggestRelatedCitations(text, inputs, {
                limit: this.limit,
                quality: 'passage',
                exclude: unitExclude,
                excludeDocumentId: this.excludeDocumentId || undefined,
              });
            }
            // Tag lexical rows for merge.
            lexical = lexical.map((r) => ({
              ...r,
              reason: r.reason || 'lexical',
            }));

            let graphRows: RelatedCitationRow[] = [];
            const graphUnit = step
              ? { documentId: step.documentId, unitIndex: step.unitIndex }
              : this.graphWithinPool
                ? this.unitExclude()
                : undefined;
            if (graphUnit && seedNeighbors.length) {
              const neighbors = this.graphWithinPool
                ? neighborsInLoadedPool(
                    seedNeighbors,
                    inputs.map((d) => d.documentId),
                  )
                : seedNeighbors;
              graphRows = rowsFromGraphNeighbors(
                graphUnit.documentId,
                graphUnit.unitIndex,
                neighbors,
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
    this.nav.openReading(row.documentId, {
      unitIndex: row.unitIndex,
      stack: this.openStack === 'push' ? 'push' : 'keep',
    });
  }

  private unitExclude():
    | { documentId: string; unitIndex: number }
    | undefined {
    const id = (this.excludeUnitDocumentId || '').trim();
    const unit = this.excludeUnitIndex;
    if (!id || unit == null || !Number.isFinite(unit) || unit < 0) {
      return undefined;
    }
    return { documentId: id, unitIndex: unit };
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
