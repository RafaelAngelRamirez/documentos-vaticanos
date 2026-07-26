import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TocEntry } from 'src/app/services/document-toc.logic';
import { CoverHeaderComponent } from './cover-header.component';
import { DocTocComponent } from './doc-toc.component';
import { MetaGridCell, MetaGridComponent } from './meta-grid.component';
import { ReadingCtasComponent } from './reading-ctas.component';

/**
 * Portada de documento unificada 2A (móvil) + 5C (desktop ≥1024px).
 * Un solo árbol de contenido; CTAs/TOC se reubican con CSS.
 *
 * Slots (atributo en el hijo proyectado):
 * - `[cover-lang]` idioma
 * - `[cover-source]` fuente / compilador
 * - `[cover-context]` contexto histórico
 * - `[cover-refs]` referencias / obras hermanas
 * - `[cover-related]` relacionados
 * - default `ng-content` extras
 */
@Component({
  standalone: true,
  selector: 'app-reading-cover',
  imports: [
    CommonModule,
    CoverHeaderComponent,
    MetaGridComponent,
    DocTocComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './reading-cover.component.html',
  styleUrls: ['./reading-cover.component.css'],
})
export class ReadingCoverComponent {
  @Input() backLabel = '← Biblioteca';
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() loadingLabel = 'Cargando…';

  @Input() kindLine = '';
  @Input() title = '';
  @Input() subtitle: string | null | undefined;
  @Input() metaCells: MetaGridCell[] = [];
  @Input() chapters: TocEntry[] = [];
  @Input() tocEmptyHint: string | null = null;

  @Input() canContinue = false;
  @Input() positionLabel: string | null | undefined;
  @Input() showListen = true;

  @Input() fav = false;
  @Input() showFav = true;

  @Output() back = new EventEmitter<void>();
  @Output() favToggle = new EventEmitter<void>();
  @Output() start = new EventEmitter<void>();
  @Output() listen = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();
  @Output() selectToc = new EventEmitter<TocEntry>();

  get hasBody(): boolean {
    return !this.loading && !this.error && !!this.title;
  }

  onSelectToc(entry: TocEntry): void {
    this.selectToc.emit(entry);
  }
}
