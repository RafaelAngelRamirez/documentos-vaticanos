import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  RelatedCitationRow,
  suggestRelatedCitations,
  suggestRelatedForDocument,
  suggestRelatedForSaint,
  suggestRelatedForStep,
  ThemeStepSeed,
  toSearchDocumentInput,
} from 'src/app/core/search/semantic-search.logic';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';

export type RelatedUnitsVariant = 'passage' | 'saint' | 'document';

/**
 * Offline “pasajes relacionados” list (3E-style rows).
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
  ) {}

  get resolvedLede(): string {
    if (this.lede != null) return this.lede;
    if (this.variant === 'saint') {
      return 'Coincidencias léxicas offline en el corpus (no son citas del santo).';
    }
    if (this.variant === 'document') {
      return 'Pasajes de otras obras del corpus con vocabulario afín (sugerencia offline).';
    }
    return 'Sugeridos offline a partir del pasaje (mismas citas estables del corpus).';
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

    this.docs.ensureAllLoaded().subscribe({
      next: (list) => {
        if (myGen !== this.gen) return;
        try {
          const inputs = list.map((d) =>
            toSearchDocumentInput(
              d.id || d.nombre || '',
              d.indice,
              d.documento || [],
            ),
          );
          let rows: RelatedCitationRow[] = [];
          if (step) {
            rows = suggestRelatedForStep(step, inputs, {
              limit: this.limit,
              quality: 'passage',
            });
          } else if (text && this.variant === 'saint') {
            rows = suggestRelatedForSaint(text, inputs, {
              limit: this.limit,
              preferDocumentIds: this.preferDocumentIds || undefined,
            });
          } else if (text && this.variant === 'document') {
            rows = suggestRelatedForDocument(text, inputs, {
              documentId: this.excludeDocumentId || undefined,
              limit: this.limit,
            });
          } else if (text) {
            rows = suggestRelatedCitations(text, inputs, {
              limit: this.limit,
              quality: 'passage',
              excludeDocumentId: this.excludeDocumentId || undefined,
            });
          }
          this.rows = rows;
        } catch {
          this.rows = [];
          this.loadError = null; // degrade quietly offline
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
}
