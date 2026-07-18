import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import {
  CONTEXT_AXIS_LABELS,
  ContextReference,
  ResolvedHistoricalContext,
} from 'src/app/core/context/historical-context.models';
import {
  AxisRowForUi,
  axisRowsForUi,
  orderedRefIds,
  resolveRefIds,
  sourceMarkers,
} from 'src/app/core/context/historical-context-resolve.logic';

/**
 * Bloque reutilizable de contexto histórico (ficha 2A / santoral).
 * Muestra citas densas: marcadores [n] por párrafo/eje + bibliografía numerada.
 */
@Component({
  standalone: true,
  selector: 'app-historical-context-block',
  imports: [CommonModule],
  templateUrl: './historical-context-block.component.html',
  styleUrls: ['./historical-context-block.component.css'],
})
export class HistoricalContextBlockComponent implements OnChanges {
  @Input() ctx: ResolvedHistoricalContext | null = null;
  @Input() sectionTitle = 'Contexto histórico';
  @Input() compact = false;

  axisRows: AxisRowForUi[] = [];
  /** Ordered ref ids for [1]…[n] markers. */
  refOrder: string[] = [];
  /** Numbered bibliography for the expanded block. */
  numberedRefs: { n: number; ref: ContextReference }[] = [];
  expanded = false;

  summaryMarkers = '';
  workMarkers = '';
  chronoMarkers = '';
  summarySources: ContextReference[] = [];
  workSources: ContextReference[] = [];
  chronoSources: ContextReference[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ctx']) {
      this.rebuild();
      this.expanded = false;
    }
  }

  private rebuild(): void {
    const c = this.ctx;
    if (!c) {
      this.axisRows = [];
      this.refOrder = [];
      this.numberedRefs = [];
      this.summaryMarkers = '';
      this.workMarkers = '';
      this.chronoMarkers = '';
      this.summarySources = [];
      this.workSources = [];
      this.chronoSources = [];
      return;
    }
    this.refOrder = orderedRefIds(c);
    this.axisRows = axisRowsForUi(
      c.axes,
      CONTEXT_AXIS_LABELS,
      c.axisSources,
      c.references,
    );
    this.summaryMarkers = sourceMarkers(c.summaryRefIds, this.refOrder);
    this.workMarkers = sourceMarkers(c.workSummaryRefIds, this.refOrder);
    this.chronoMarkers = sourceMarkers(c.chronologyRefIds, this.refOrder);
    this.summarySources = resolveRefIds(c.summaryRefIds, c.references);
    this.workSources = resolveRefIds(c.workSummaryRefIds, c.references);
    this.chronoSources = resolveRefIds(c.chronologyRefIds, c.references);

    const byId = new Map(
      (c.references || []).filter((r) => r.id).map((r) => [r.id as string, r]),
    );
    this.numberedRefs = this.refOrder
      .map((id, i) => {
        const ref = byId.get(id);
        return ref ? { n: i + 1, ref } : null;
      })
      .filter((x): x is { n: number; ref: ContextReference } => !!x);
  }

  get hasContent(): boolean {
    if (!this.ctx) return false;
    return !!(
      this.ctx.generalSummary ||
      this.ctx.workSummary ||
      this.ctx.chronologyNote ||
      this.axisRows.length ||
      (this.ctx.references && this.ctx.references.length)
    );
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  markersForAxis(row: AxisRowForUi): string {
    return sourceMarkers(row.refIds, this.refOrder);
  }

  timelineMarkers(refIds?: string[]): string {
    return sourceMarkers(refIds, this.refOrder);
  }
}
