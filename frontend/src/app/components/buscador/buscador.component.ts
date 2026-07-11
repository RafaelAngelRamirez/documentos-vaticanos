import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { BuscadorService, TermsProcessed } from './buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos as DocumentoDatos,
} from 'src/app/services/cargar-documentos-json.service';
import { PuntoModule } from '../punto/punto.module';
import { CommonModule } from '@angular/common';
import { ArticleInfo } from '../punto/punto/punto.component';
import { UtilidadesService } from 'src/app/services/utilidades.service';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { NavigationService } from 'src/app/services/navigation.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';

@Component({
  standalone: true,
  selector: 'app-buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css'],
  imports: [PuntoModule, CommonModule, MatPaginatorModule],
})
export class BuscadorComponent implements OnInit, OnDestroy {
  terminos: TermsProcessed = {};

  docs_resultados: ResultadoDeBusqueda[] = [];

  page_size = 10;
  page_size_options = [5, 10, 25, 100];

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

  get hasAnyHits(): boolean {
    return this.docs_resultados.some((r) => r.puntos.length > 0);
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

  shortLabel(r: ResultadoDeBusqueda): string | null {
    const short =
      r.doc.shortTitle || this.corpus.getMeta(r.doc.id || '')?.shortTitle;
    const full = this.displayTitle(r);
    if (!short || short === full) return null;
    return short;
  }

  localeLabel(r: ResultadoDeBusqueda): string {
    const locale =
      r.doc.locale || this.corpus.getMeta(r.doc.id || '')?.locale || 'es';
    return CorpusService.localeLabel(locale);
  }

  sourceUrl(r: ResultadoDeBusqueda): string | null {
    return (
      r.doc.sourceUrl ||
      this.corpus.getMeta(r.doc.id || '')?.sourceUrl ||
      null
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
        puntos_paginados: puntos_completos.slice(0, this.page_size),
      });
    }
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

  handlePageEvent($event: PageEvent, doc_resultado: ResultadoDeBusqueda) {
    const init = $event.pageIndex * this.page_size;
    const end = $event.pageIndex * this.page_size + this.page_size;
    doc_resultado.puntos_paginados = doc_resultado.puntos.slice(init, end);
  }

  navigate_to_read(punto: ArticleInfo, resultado: ResultadoDeBusqueda) {
    this.navigationService.go_to_read_article(punto, resultado);
  }
}

export interface ResultadoDeBusqueda {
  doc: DocumentoDatos;
  puntos: ArticleInfo[];
  puntos_paginados: ArticleInfo[];
}
