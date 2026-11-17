import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TocEntry } from 'src/app/services/document-toc.logic';
import { CoverHeaderComponent } from './cover-header.component';
import { DocTocComponent } from './doc-toc.component';
import { ReadingCtasComponent } from './reading-ctas.component';

/**
 * Portada de documento unificada 2A (móvil) + 5C (desktop ≥1024px).
 * Una sola cabecera, en la misma columna que la tarjeta de metadatos.
 * CTAs e índice se reubican con CSS.
 *
 * La lectura queda fuera del cierre: idioma, índice y acciones.
 * Estudio empieza cerrado y no cambia la URL.
 *
 * Slots (atributo en el hijo proyectado):
 * - `[cover-lang]` idioma, en el flujo de lectura
 * - `[cover-ficha]` rejilla de consulta, dentro de Estudio
 * - `[cover-source]` fuente / compilador, dentro de Estudio
 * - `[cover-context]` contexto histórico, dentro de Estudio
 * - `[cover-refs]` autor y obras hermanas, dentro de Estudio
 * - `[cover-related]` citas y vocabulario parecido, dentro de Estudio
 * - default `ng-content` extras, en el flujo de lectura
 */
@Component({
  standalone: true,
  selector: 'app-reading-cover',
  imports: [
    CommonModule,
    CoverHeaderComponent,
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
