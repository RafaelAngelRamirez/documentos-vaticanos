import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { BuscadorService, TermsProcessed } from './buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos as DocumentoDatos,
} from 'src/app/services/cargar-documentos-json.service';
import { CommonModule } from '@angular/common';
import { ArticleInfo } from '../punto/punto/punto.component';
import { UtilidadesService } from 'src/app/services/utilidades.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';

const PAGE = 50;

/** Fila plana de resultado (diseño 3E: doc · Nº + fragmento). */
export interface SearchRow {
  title: string;
  snippetHtml: string;
  punto: ArticleInfo;
  resultado: ResultadoDeBusqueda;
}

@Component({
  standalone: true,
  selector: 'app-buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css'],
  imports: [CommonModule],
})
export class BuscadorComponent implements OnInit, OnDestroy {
  terminos: TermsProcessed = {};

  docs_resultados: ResultadoDeBusqueda[] = [];

  /** Diseño 3E: lista plana de filas. */
  rows: SearchRow[] = [];
  visibleCount = PAGE;

  loading_docs = false;
  load_error: string | null = null;
  private docs_ready = false;
  private pending_terminos: TermsProcessed | null = null;
  private sub = new Subscription();

  constructor(
    public busadorService: BuscadorService,
    private documentosService: CargarDocumentosJsonService,
    private utilidadesService: UtilidadesService,
    private navigationService: NavigationService,
    private corpus: CorpusService
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.busadorService.terminos_emit.subscribe((terminos) => {
        this.terminos = terminos;
        this.procesar_busqueda(terminos);
      })
    );

    this.loading_docs = true;
    this.sub.add(
      this.documentosService.ensureAllLoaded().subscribe({
        next: () => {
          this.loading_docs = false;
          this.docs_ready = true;
          this.load_error = null;
          if (this.pending_terminos) {
            this.procesar_busqueda(this.pending_terminos);
            this.pending_terminos = null;
          }
        },
        error: (err) => {
          this.loading_docs = false;
          this.load_error =
            err?.message ?? 'No se pudieron cargar los documentos.';
          console.error(err);
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get hasQuery(): boolean {
    return Boolean(
      (this.terminos.terminos && this.terminos.terminos.length) ||
        (this.terminos.puntos && this.terminos.puntos.length)
    );
  }

  get visibleRows(): SearchRow[] {
    return this.rows.slice(0, this.visibleCount);
  }

  get remaining(): number {
    return Math.max(0, this.rows.length - this.visibleCount);
  }

  /** «14 resultados en 5 documentos». */
  get countLabel(): string {
    const total = this.rows.length;
    const docs = this.docs_resultados.filter((r) => r.puntos.length > 0).length;
    const res = total === 1 ? 'resultado' : 'resultados';
    const dcs = docs === 1 ? 'documento' : 'documentos';
    return `${total} ${res} en ${docs} ${dcs}`;
  }

  showMore(): void {
    this.visibleCount += PAGE;
  }

  openRow(row: SearchRow): void {
    this.navigationService.go_to_read_article(row.punto, row.resultado);
  }

  displayTitle(r: ResultadoDeBusqueda): string {
    return (
      r.doc.title ||
      r.doc.nombre ||
      this.corpus.getMeta(r.doc.id || '')?.title ||
      r.doc.id ||
      'Documento'
    );
  }

  shortLabel(r: ResultadoDeBusqueda): string {
    return (
      r.doc.shortTitle ||
      this.corpus.getMeta(r.doc.id || '')?.shortTitle ||
      this.displayTitle(r)
    );
  }

  procesar_busqueda(terminos: TermsProcessed) {
    if (!this.docs_ready) {
      this.pending_terminos = terminos;
      return;
    }

    this.docs_resultados = [];
    for (const doc of this.documentosService.documentos_disponibles) {
      let indice_puntos_seleccionados: number[] = [];

      const puntos_senalados = terminos.puntos ?? [];
      const indice_por_puntos = doc.indice.indice_por_punto;

      puntos_senalados.forEach((p) => {
        const i = this.buscar_por_valor_una_llave(p, indice_por_puntos);
        if (i !== undefined) indice_puntos_seleccionados.push(i);
      });

      const palabras_a_buscar = (terminos.terminos ?? [])
        .map((palabra) =>
          this.utilidadesService.texto.eliminar_diacriticos(palabra)
        )
        .map((x) => x.toLowerCase());

      palabras_a_buscar.forEach((palabra) => {
        const p = doc.indice.indice[palabra];
        if (p) indice_puntos_seleccionados.push(...p);
      });

      // de-dupe while preserving order
      const seen = new Set<number>();
      indice_puntos_seleccionados = indice_puntos_seleccionados.filter((i) => {
        if (seen.has(i)) return false;
        seen.add(i);
        return true;
      });

      const puntos_completos = indice_puntos_seleccionados
        .map((p) => doc.documento[p])
        .filter((article) => !!article)
        .map((article) => {
          return { article, terms_pure: palabras_a_buscar } as ArticleInfo;
        });

      this.docs_resultados.push({
        doc,
        puntos: puntos_completos,
        puntos_paginados: puntos_completos,
      });
    }

    this.buildRows();
  }

  /** Aplana los resultados por documento en filas del diseño 3E. */
  private buildRows(): void {
    const rows: SearchRow[] = [];
    for (const resultado of this.docs_resultados) {
      const docLabel = this.shortLabel(resultado);
      for (const punto of resultado.puntos) {
        const art = punto.article;
        const unidad =
          art.biblia?.consecutivo_versiculo ||
          (art.consecutivo && art.consecutivo !== 'no-encontrado'
            ? art.consecutivo
            : String((art.index_array ?? 0) + 1));
        rows.push({
          title: `${docLabel} · Nº ${unidad}`,
          snippetHtml: this.buildSnippet(
            art.contenido ?? '',
            punto.terms_pure ?? []
          ),
          punto,
          resultado,
        });
      }
    }
    this.rows = rows;
    this.visibleCount = PAGE;
  }

  /**
   * Fragmento con término resaltado (diseño 3E). Los rangos se calculan
   * sobre el texto plano y cada tramo se escapa por separado, de modo que
   * el HTML resultante solo contiene nuestros <b class="hl">.
   */
  private buildSnippet(contenido: string, terms: string[]): string {
    const raw = contenido
      .replace(/\[\+\[\d+\]\+\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fold = (s: string) =>
      this.utilidadesService.texto.eliminar_diacriticos(s).toLowerCase();
    const foldedRaw = fold(raw);

    let firstIdx = -1;
    let firstLen = 0;
    for (const t of terms) {
      const ft = fold(t);
      if (!ft) continue;
      const i = foldedRaw.indexOf(ft);
      if (i >= 0 && (firstIdx < 0 || i < firstIdx)) {
        firstIdx = i;
        firstLen = ft.length;
      }
    }

    let start = 0;
    let end = Math.min(raw.length, 170);
    if (firstIdx >= 0) {
      start = Math.max(0, firstIdx - 70);
      end = Math.min(raw.length, firstIdx + firstLen + 100);
    }
    const slice = raw.slice(start, end);
    const foldedSlice = foldedRaw.slice(start, end);

    type R = { s: number; e: number };
    const ranges: R[] = [];
    for (const t of terms) {
      const ft = fold(t);
      if (!ft) continue;
      let from = 0;
      while (from < foldedSlice.length) {
        const i = foldedSlice.indexOf(ft, from);
        if (i < 0) break;
        ranges.push({ s: i, e: i + ft.length });
        from = i + ft.length;
      }
    }
    ranges.sort((a, b) => a.s - b.s || b.e - a.e);
    const merged: R[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.s < last.e) {
        last.e = Math.max(last.e, r.e);
      } else {
        merged.push({ ...r });
      }
    }

    let html = '';
    let cursor = 0;
    for (const r of merged) {
      html += this.escapeHtml(slice.slice(cursor, r.s));
      html += '<b class="hl">' + this.escapeHtml(slice.slice(r.s, r.e)) + '</b>';
      cursor = r.e;
    }
    html += this.escapeHtml(slice.slice(cursor));

    const pre = start > 0 ? '…' : '';
    const post = end < raw.length ? '…' : '';
    return `${pre}${html}${post}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  buscar_por_valor_una_llave(
    valor: number,
    objeto: { [key: number]: number | null }
  ) {
    for (const llave in objeto) {
      const llave_num = parseInt(llave, 10);
      if (objeto.hasOwnProperty(llave_num) && objeto[llave_num] === valor)
        return llave_num;
    }
    return undefined;
  }
}

export interface ResultadoDeBusqueda {
  doc: DocumentoDatos;
  puntos: ArticleInfo[];
  puntos_paginados: ArticleInfo[];
}
