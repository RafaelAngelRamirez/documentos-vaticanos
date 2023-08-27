import { Component } from '@angular/core';
import { BuscadorService, TermsProcessed } from './buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos as DocumentoDatos,
  Article,
} from 'src/app/services/cargar-documentos-json.service';
import { PuntoModule } from '../punto/punto.module';
import { CommonModule } from '@angular/common';
import { ArticleInfo } from '../punto/punto/punto.component';
import { UtilidadesService } from 'src/app/services/utilidades.service';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css'],
  imports: [PuntoModule, CommonModule, MatPaginatorModule],
})
export class BuscadorComponent {
  terminos: TermsProcessed = {};

  docs_resultados: ResultadoDeBusqueda[] = [];

  page_size = 10;
  page_size_options = [5, 10, 25, 100];

  constructor(
    public busadorService: BuscadorService,
    private documentosService: CargarDocumentosJsonService,
    private utilidadesService: UtilidadesService,
    private navigationService: NavigationService
  ) {
    this.busadorService.terminos_emit.subscribe((terminos) => {
      this.terminos = terminos;

      this.procesar_busqueda(terminos);
    });
  }

  procesar_busqueda(terminos: TermsProcessed) {
    this.docs_resultados = [];
    for (const doc of this.documentosService.documentos_disponibles) {
      let indice_puntos_seleccionados: number[] = [];

      // Obtenemos los puntos señalados.
      let puntos_senalados = terminos.puntos ?? [];
      // Obtener el indice contra el punto señalado.
      let indice_por_puntos = doc.indice.indice_por_punto;

      puntos_senalados.forEach((p) => {
        let i = this.buscar_por_valor_una_llave(p, indice_por_puntos);
        if (i) indice_puntos_seleccionados.push(i);
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
        .map((article) => {
          return { article, terms_pure: palabras_a_buscar } as ArticleInfo;
        });

      let resultado = {
        doc,
        puntos: puntos_completos,
        puntos_paginados: puntos_completos.slice(0, -1 + this.page_size),
      };

      this.docs_resultados.push(resultado);
    }
  }

  buscar_por_valor_una_llave(
    valor: number,
    objeto: { [key: number]: number | null }
  ) {
    for (let llave in objeto) {
      let llave_num = parseInt(llave);
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
    this.navigationService.go_to_read_article(
      punto,
      resultado,
    );
  }
}

export interface ResultadoDeBusqueda {
  doc: DocumentoDatos;
  puntos: ArticleInfo[];
  puntos_paginados: ArticleInfo[];
}
