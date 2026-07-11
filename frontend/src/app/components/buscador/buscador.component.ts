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
    private navigationService: NavigationService
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

  procesar_busqueda(terminos: TermsProcessed) {
    if (!this.docs_ready) {
      this.pending_terminos = terminos;
      return;
    }

    this.docs_resultados = [];
    for (const doc of this.documentosService.documentos_disponibles) {
      let indice_puntos_seleccionados: number[] = [];

      // Obtenemos los puntos señalados.
      let puntos_senalados = terminos.puntos ?? [];
      // Obtener el indice contra el punto señalado.
      let indice_por_puntos = doc.indice.indice_por_punto;

      puntos_senalados.forEach((p) => {
        let i = this.buscar_por_valor_una_llave(p, indice_por_puntos);
        if (i !== undefined) indice_puntos_seleccionados.push(i);
      });

      // Las palabras a buscar.
      let palabras_a_buscar = (terminos.terminos ?? [])
        .map((palabra) =>
          this.utilidadesService.texto.eliminar_diacriticos(palabra)
        )
        .map((x) => x.toLowerCase());

      palabras_a_buscar.forEach((palabra) => {
        let p = doc.indice.indice[palabra];
        if (p) indice_puntos_seleccionados.push(...p);
      });

      let puntos_completos = indice_puntos_seleccionados
        .map((p) => doc.documento[p])
        .filter((article) => !!article)
        .map((article) => {
          return { article, terms_pure: palabras_a_buscar } as ArticleInfo;
        });

      let resultado = {
        doc,
        puntos: puntos_completos,
        puntos_paginados: puntos_completos.slice(0, this.page_size),
      };

      this.docs_resultados.push(resultado);
    }
  }

  buscar_por_valor_una_llave(
    valor: number,
    objeto: { [key: number]: number | null }
  ) {
    for (let llave in objeto) {
      let llave_num = parseInt(llave, 10);
      if (objeto.hasOwnProperty(llave_num) && objeto[llave_num] === valor)
        return llave_num;
    }
    return undefined;
  }

  handlePageEvent($event: PageEvent, doc_resultado: ResultadoDeBusqueda) {
    let init = $event.pageIndex * this.page_size;
    let end = $event.pageIndex * this.page_size + this.page_size;
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
