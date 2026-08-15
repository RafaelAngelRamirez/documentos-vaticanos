import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ResultadoDeBusqueda } from '../components/buscador/buscador.component';
import { ArticleInfo } from '../components/punto/punto/punto.component';
import { IndiceDocumentos } from './cargar-documentos-json.service';

export enum ROUTE {
  'leyendo' = 'leyendo',
  'punto' = 'punto',
  'inicio' = 'inicio',
  'list_documents' = 'documentos/listar',
  documento = 'documento',
  about = 'about',
}

export const LOCALSTORAGE_KEYS = [
  'document_selected',
  'article_selected',
  'actual_index',
];

export const AUTO_NARR_KEY = 'dv.autoNarr';

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

  routes = ROUTE;

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
   * Cover / CTA entry to the immersive reader.
   * When autoNarr, set sessionStorage so LectorComponent starts the narrator.
   */
  openReading(
    doc: IndiceDocumentos,
    opts?: { unitIndex?: number; autoNarr?: boolean }
  ): void {
    this.document_selected = doc;
    this.actual_index = opts?.unitIndex ?? 0;
    this.article_selected = undefined;
    this.save_actual_index();
    try {
      if (opts?.autoNarr) sessionStorage.setItem(AUTO_NARR_KEY, '1');
      else sessionStorage.removeItem(AUTO_NARR_KEY);
    } catch {
      /* ignore */
    }
    this.router.navigate([
      ROUTE.leyendo,
      doc.nombre,
      ROUTE.punto,
      this.actual_index,
    ]);
  }

  goToCover(nombre: string): void {
    this.router.navigate(['/', ROUTE.documento, nombre]);
  }

  load_actual_index() {
    type ObjectKey = keyof typeof this;
    LOCALSTORAGE_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        this[key as ObjectKey] = JSON.parse(value);
      }
    });
  }

  save_actual_index() {
    type ObjectKey = keyof typeof this;
    LOCALSTORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      const string_value_to_save = JSON.stringify(this[key as ObjectKey]);
      localStorage.setItem(key, string_value_to_save);
    });
  }

  go_to_search() {
    this.router.navigate(['/', ROUTE.inicio]);
  }

  go_to_documents() {
    const route = ['/', ...ROUTE.list_documents.split('/')];
    this.router.navigate(route);
  }

  go_to_about() {
    this.router.navigate(['/', ROUTE.about]);
  }
}
