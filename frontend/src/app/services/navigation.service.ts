import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ResultadoDeBusqueda } from '../components/buscador/buscador.component';
import { ArticleInfo } from '../components/punto/punto/punto.component';
import { IndiceDocumentos } from './cargar-documentos-json.service';

export enum ROUTE {
  'leyendo' = 'leyendo',
  'punto' = 'punto',
  'inicio' = 'inicio',
}

export const LOCALSTORAGE_KEYS = [
  'document_selected',
  'article_selected',
  'actual_index',
];

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  constructor(private router: Router) {
    this.load_actual_index();
  }

  document_selected: IndiceDocumentos | undefined = undefined;
  article_selected: ArticleInfo | undefined = undefined;
  actual_index: number = 0;

  go_to_read_article(article: ArticleInfo, result: ResultadoDeBusqueda) {
    this.document_selected = result.doc;
    this.article_selected = article;
    this.actual_index = article.article.index_array;
    const documento = result.doc.nombre;

    this.save_actual_index();

    this.router.navigate([
      ROUTE.leyendo,
      documento,
      ROUTE.punto,
      article.article.consecutivo,
    ]);
  }

  /**
   *If exist, restore all data to continue with
   * the read
   *
   * @memberof NavigationService
   */
  load_actual_index() {
    type ObjectKey = keyof typeof this;
    LOCALSTORAGE_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        this[key as ObjectKey] = JSON.parse(value);
      }
    });
  }

  /**
   *Save actual data in local storage to comeback if the page it is
   * reloaded.
   *
   * @memberof NavigationService
   */
  save_actual_index() {
    type ObjectKey = keyof typeof this;

    LOCALSTORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      const string_value_to_save = JSON.stringify(this[key as ObjectKey]);
      console.log(string_value_to_save);
      localStorage.setItem(key, string_value_to_save);
    });
  }

  go_to_search() {
    this.router.navigate(['/', ROUTE.inicio]);
  }
}
