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
  about = 'about',
}

/** Keys persisted to localStorage (avoid full multi-MB document JSON). */
export const LOCALSTORAGE_KEYS = [
  'document_id',
  'article_selected',
  'actual_index',
] as const;

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  constructor(private router: Router) {
    this.load_actual_index();
  }

  /** Stable corpus id (preferred) or legacy display name. */
  document_id: string | undefined = undefined;

  /** In-memory only; rebuilt via CorpusService when missing after reload. */
  document_selected: IndiceDocumentos | undefined = undefined;
  article_selected: ArticleInfo | undefined = undefined;
  actual_index: number = 0;

  routes = ROUTE;

  go_to_read_article(article: ArticleInfo, result: ResultadoDeBusqueda) {
    this.document_selected = result.doc;
    this.document_id = result.doc.id ?? result.doc.nombre;
    this.article_selected = {
      article: article.article,
      terms_pure: article.terms_pure ?? [],
      termns: article.termns,
    };
    this.actual_index = article.article.index_array;
    const documento = this.document_id;

    this.save_actual_index();

    this.router.navigate([
      ROUTE.leyendo,
      documento,
      ROUTE.punto,
      article.article.consecutivo,
    ]);
  }

  /**
   * If present, restore lightweight navigation state to continue reading.
   */
  load_actual_index() {
    const documentId = localStorage.getItem('document_id');
    if (documentId) {
      try {
        // Prefer plain string; accept JSON-stringified legacy values.
        this.document_id = JSON.parse(documentId);
      } catch {
        this.document_id = documentId;
      }
    } else {
      // Migrate legacy full-document localStorage entries.
      const legacyDoc = localStorage.getItem('document_selected');
      if (legacyDoc) {
        try {
          const parsed = JSON.parse(legacyDoc) as IndiceDocumentos;
          this.document_id = parsed?.id ?? parsed?.nombre;
          localStorage.removeItem('document_selected');
        } catch {
          localStorage.removeItem('document_selected');
        }
      }
    }

    const articleRaw = localStorage.getItem('article_selected');
    if (articleRaw) {
      try {
        this.article_selected = JSON.parse(articleRaw);
      } catch {
        this.article_selected = undefined;
      }
    }

    const indexRaw = localStorage.getItem('actual_index');
    if (indexRaw) {
      try {
        this.actual_index = JSON.parse(indexRaw);
      } catch {
        const n = Number(indexRaw);
        this.actual_index = Number.isFinite(n) ? n : 0;
      }
    }
  }

  /**
   * Persist navigation pointers (not full document bodies).
   */
  save_actual_index() {
    if (this.document_id) {
      localStorage.setItem('document_id', JSON.stringify(this.document_id));
    } else {
      localStorage.removeItem('document_id');
    }
    // Drop any leftover full-document blob.
    localStorage.removeItem('document_selected');

    if (this.article_selected) {
      localStorage.setItem(
        'article_selected',
        JSON.stringify(this.article_selected)
      );
    } else {
      localStorage.removeItem('article_selected');
    }

    localStorage.setItem('actual_index', JSON.stringify(this.actual_index));
  }

  go_to_search() {
    this.router.navigate(['/', ROUTE.inicio]);
  }

  go_to_documents() {
    const route = ['/', ...ROUTE.list_documents.split('/')];
    this.router.navigate(route);
  }

  go_to_about() {
    const route = ['/', ROUTE.about];
    this.router.navigate(route);
  }
}
