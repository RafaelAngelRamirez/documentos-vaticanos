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

const STACK_STORAGE_KEY = 'nav_stack';
const STACK_CAP = 32;

export interface NavFrame {
  documentId: string;
  actual_index: number;
  consecutivo?: string;
  label?: string;
}

export interface NavigateToUnitOptions {
  /** When true, push the current location onto the stack before navigating. */
  fromRef?: boolean;
  consecutivo?: string;
  label?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  constructor(private router: Router) {
    this.load_actual_index();
    this.loadStack();
  }

  /** Stable corpus id (preferred) or legacy display name. */
  document_id: string | undefined = undefined;

  /** In-memory only; rebuilt via CorpusService when missing after reload. */
  document_selected: IndiceDocumentos | undefined = undefined;
  article_selected: ArticleInfo | undefined = undefined;
  actual_index: number = 0;

  private stack: NavFrame[] = [];

  routes = ROUTE;

  /**
   * Navigate from search results. Clears the reference navigation stack
   * so "Volver a la cita" does not jump back into an older trail.
   */
  go_to_read_article(article: ArticleInfo, result: ResultadoDeBusqueda) {
    this.clearStack();

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
   * Navigate to a unit by document id + array index.
   * When `fromRef` is set, the current frame is pushed onto the stack.
   */
  navigateToUnit(
    documentId: string,
    arrayIndex: number,
    options?: NavigateToUnitOptions
  ): void {
    if (!documentId || !Number.isFinite(arrayIndex) || arrayIndex < 0) {
      return;
    }

    if (options?.fromRef) {
      this.pushCurrentFrame(options.label);
    }

    const sameDoc =
      this.document_selected &&
      (this.document_selected.id === documentId ||
        this.document_selected.nombre === documentId);

    if (!sameDoc) {
      // Force lector to reload via ensureLoaded for a different document.
      this.document_selected = undefined;
    }

    this.document_id = documentId;
    this.actual_index = arrayIndex;
    // Drop search-term highlights when jumping via reference.
    this.article_selected = undefined;

    let consecutivo = options?.consecutivo;
    if (
      consecutivo == null &&
      sameDoc &&
      this.document_selected?.documento?.[arrayIndex]
    ) {
      consecutivo = this.document_selected.documento[arrayIndex].consecutivo;
    }
    // Prefer array index in the route when consecutivo is missing/unreliable.
    const routePunto =
      consecutivo != null &&
      consecutivo !== '' &&
      consecutivo !== 'no-encontrado'
        ? consecutivo
        : String(arrayIndex);

    this.save_actual_index();

    this.router.navigate([
      ROUTE.leyendo,
      documentId,
      ROUTE.punto,
      routePunto,
    ]);
  }

  /**
   * Pop the stack and restore the previous document/unit.
   * @returns false if there was nothing to go back to.
   */
  goBack(): boolean {
    if (!this.canGoBack()) {
      return false;
    }

    const frame = this.stack.pop()!;
    this.persistStack();

    const sameDoc =
      this.document_selected &&
      (this.document_selected.id === frame.documentId ||
        this.document_selected.nombre === frame.documentId);

    if (!sameDoc) {
      this.document_selected = undefined;
    }

    this.document_id = frame.documentId;
    this.actual_index = frame.actual_index;
    this.article_selected = undefined;
    this.save_actual_index();

    const routePunto =
      frame.consecutivo != null &&
      frame.consecutivo !== '' &&
      frame.consecutivo !== 'no-encontrado'
        ? frame.consecutivo
        : String(frame.actual_index);

    this.router.navigate([
      ROUTE.leyendo,
      frame.documentId,
      ROUTE.punto,
      routePunto,
    ]);
    return true;
  }

  canGoBack(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Push current location then navigate (convenience for call sites).
   */
  pushAndGo(target: {
    documentId: string;
    index: number;
    consecutivo?: string;
    label?: string;
  }): void {
    this.navigateToUnit(target.documentId, target.index, {
      fromRef: true,
      consecutivo: target.consecutivo,
      label: target.label,
    });
  }

  private pushCurrentFrame(label?: string): void {
    if (!this.document_id) {
      return;
    }

    const consecutivo =
      this.article_selected?.article?.consecutivo ??
      this.document_selected?.documento?.[this.actual_index]?.consecutivo;

    const frame: NavFrame = {
      documentId: this.document_id,
      actual_index: this.actual_index,
      consecutivo:
        consecutivo && consecutivo !== 'no-encontrado'
          ? consecutivo
          : String(this.actual_index),
      label,
    };

    this.stack.push(frame);
    if (this.stack.length > STACK_CAP) {
      this.stack = this.stack.slice(this.stack.length - STACK_CAP);
    }
    this.persistStack();
  }

  private clearStack(): void {
    this.stack = [];
    this.persistStack();
  }

  private persistStack(): void {
    try {
      sessionStorage.setItem(STACK_STORAGE_KEY, JSON.stringify(this.stack));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  private loadStack(): void {
    try {
      const raw = sessionStorage.getItem(STACK_STORAGE_KEY);
      if (!raw) {
        this.stack = [];
        return;
      }
      const parsed = JSON.parse(raw) as NavFrame[];
      if (!Array.isArray(parsed)) {
        this.stack = [];
        return;
      }
      this.stack = parsed
        .filter(
          (f) =>
            f &&
            typeof f.documentId === 'string' &&
            Number.isFinite(f.actual_index)
        )
        .slice(-STACK_CAP);
    } catch {
      this.stack = [];
    }
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
