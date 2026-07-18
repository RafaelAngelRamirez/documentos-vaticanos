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
  suggestRelatedForStep,
  ThemeStepSeed,
  toSearchDocumentInput,
} from 'src/app/core/search/semantic-search.logic';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';

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
  /** Free-text seed (note body, theme description, …). */
  @Input() seedText: string | null = null;
  /** Prefer step citation: resolves unit body from pack when available. */
  @Input() seedStep: ThemeStepSeed | null = null;
  @Input() limit = 8;
  /** Show “Añadir” control (theme editor). */
  @Input() showAdd = false;
  /** Section heading (handoff .sect). */
  @Input() heading = 'Pasajes relacionados';

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

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['seedText'] ||
      changes['seedStep'] ||
      changes['limit']
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
            rows = suggestRelatedForStep(step, inputs, { limit: this.limit });
          } else if (text) {
            rows = suggestRelatedCitations(text, inputs, { limit: this.limit });
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
