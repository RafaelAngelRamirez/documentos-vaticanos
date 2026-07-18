import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import {
  CONTEXT_AXIS_LABELS,
  ContextAxes,
  ResolvedHistoricalContext,
} from 'src/app/core/context/historical-context.models';
import { axisRowsForUi } from 'src/app/core/context/historical-context-resolve.logic';

/**
 * Bloque reutilizable de contexto histórico (ficha 2A / santoral).
 * Solo tokens/clases del design system; no rompe si ctx es null.
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
  /** Título de sección (p. ej. «Contexto histórico»). */
  @Input() sectionTitle = 'Contexto histórico';
  /** Si true, muestra ejes en lista compacta. */
  @Input() compact = false;

  axisRows: { key: keyof ContextAxes; label: string; text: string }[] = [];
  expanded = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ctx']) {
      this.axisRows = axisRowsForUi(this.ctx?.axes, CONTEXT_AXIS_LABELS);
      this.expanded = false;
    }
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

  refLabel(r: { title: string; citation?: string }): string {
    return r.citation ? `${r.title} — ${r.citation}` : r.title;
  }
}
