import { Injectable } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import {
  cite,
  clearLegacyReadingKeys,
  documentIdKey,
  parseDocumentId,
  parseResumeCard,
  parseStack,
  parseUnitIndex,
  pushCite,
  readingCommands,
  sameCite,
  sameDocument,
  serializeResumeCard,
  type Cite,
  type DocumentId,
  type ResumeCard,
  type ResumeDisplay,
} from '../core/reading/cite';
import { LAST_READ_KEY } from './reading-progress.logic';
import {
  applyAutoNarrFlag,
  type OpenReadingOptions,
} from './open-reading.logic';

export enum ROUTE {
  'leyendo' = 'leyendo',
  'punto' = 'punto',
  'inicio' = 'inicio',
  'list_documents' = 'documentos/listar',
  about = 'about',
}

const STACK_STORAGE_KEY = 'nav_stack';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  /** Rises only when the route cite changes. Scroll within a book does not. */
  generation = 0;

  /** Cite the reader route is showing, once a navigation has been accepted. */
  routeCite: Cite | null = null;

  private pendingCite: Cite | null = null;
  private stack: Cite[] = [];
  private highlight: { cite: Cite; terms: readonly string[] } | null = null;

  constructor(private router: Router) {
    const local = this.localStore();
    clearLegacyReadingKeys(local);
    try {
      local?.removeItem('document_selected');
    } catch {
      // private mode
    }
    this.stack = parseStack(this.sessionGet(STACK_STORAGE_KEY));
    this.router.events.subscribe((ev) => {
      if (
        ev instanceof NavigationEnd ||
        ev instanceof NavigationCancel ||
        ev instanceof NavigationError
      ) {
        this.pendingCite = null;
      }
    });
  }

  routes = ROUTE;

  /**
   * Only door into the reader. The URL is `/leyendo/:documentId/u/:unitIndex`.
   * A title, a short title, or a non-index unit does not navigate.
   */
  openReading(
    documentId: DocumentId | string,
    options?: OpenReadingOptions,
  ): void {
    const id =
      typeof documentId === 'string' ? parseDocumentId(documentId) : documentId;
    if (!id) return;
    const unit = parseUnitIndex(
      options?.unitIndex == null ? 0 : options.unitIndex,
    );
    if (unit == null) return;
    const dest = cite(id, unit);
    if (this.pendingCite) return;

    const stackMode = options?.stack ?? 'keep';
    const same = sameCite(this.routeCite, dest);
    if (stackMode === 'clear') {
      if (this.stack.length) {
        this.stack = [];
        this.persistStack();
      }
    } else if (stackMode === 'push' && this.routeCite && !same) {
      this.stack = pushCite(this.stack, this.routeCite);
      this.persistStack();
    }

    this.highlight =
      options?.highlight && options.highlight.length
        ? { cite: dest, terms: options.highlight.slice() }
        : null;

    if (same && this.alreadyShowing(dest)) return;

    if (!same) {
      this.routeCite = dest;
      this.generation += 1;
    }
    applyAutoNarrFlag(options?.autoNarr);
    this.pendingCite = dest;
    void this.router.navigate(readingCommands(dest));
  }

  /**
   * Pop the stack and open that cite.
   * @returns false while a navigation is in flight, or when the stack is empty.
   */
  goBack(): boolean {
    if (this.pendingCite) return false;
    if (!this.stack.length) return false;
    const frame = this.stack[this.stack.length - 1];
    this.stack = this.stack.slice(0, -1);
    this.persistStack();
    this.openReading(frame.documentId, {
      unitIndex: frame.unitIndex,
      stack: 'keep',
    });
    return true;
  }

  canGoBack(): boolean {
    return this.stack.length > 0;
  }

  /** Resume card for this document, or null when the stored JSON is not a cite. */
  resume(): ResumeCard | null {
    const store = this.localStore();
    if (!store) return null;
    let raw: string | null = null;
    try {
      raw = store.getItem(LAST_READ_KEY);
    } catch {
      return null;
    }
    const card = parseResumeCard(raw);
    if (raw && !card) {
      try {
        store.removeItem(LAST_READ_KEY);
      } catch {
        // private mode
      }
    }
    return card;
  }

  /** In-memory search terms for this cite. A reload or another cite drops them. */
  highlightFor(place: Cite): readonly string[] | null {
    if (!this.highlight || !sameCite(this.highlight.cite, place)) return null;
    return this.highlight.terms;
  }

  /**
   * Record the cite the route is painting.
   * Bumps generation only when that cite is different.
   */
  seenRoute(place: Cite): number {
    if (!sameCite(this.routeCite, place)) {
      this.routeCite = place;
      this.generation += 1;
    }
    return this.generation;
  }

  /**
   * The lector reports a unit that is actually on screen.
   * A stale generation or another document does not write and does not navigate.
   */
  noteVisible(place: Cite, display: ResumeDisplay, generation: number): void {
    if (generation !== this.generation) return;
    if (!this.routeCite || !sameDocument(this.routeCite.documentId, place.documentId)) {
      return;
    }
    if (this.routeCite.unitIndex !== place.unitIndex) {
      this.routeCite = place;
      void this.router.navigate(readingCommands(place), { replaceUrl: true });
    }
    const store = this.localStore();
    if (!store) return;
    const card: ResumeCard = {
      cite: place,
      display,
      updatedAt: new Date().toISOString(),
    };
    try {
      store.setItem(LAST_READ_KEY, serializeResumeCard(card));
    } catch {
      // quota / private mode
    }
  }

  /** Legacy arrival: replace the URL with the canonical cite. Does not touch the stack. */
  replaceWith(place: Cite): void {
    this.routeCite = place;
    void this.router.navigate(readingCommands(place), { replaceUrl: true });
  }

  go_to_search() {
    this.router.navigate(['/buscar']);
  }

  go_to_documents() {
    this.router.navigate(['/biblioteca']);
  }

  go_to_about() {
    this.router.navigate(['/', ROUTE.about]);
  }

  private alreadyShowing(place: Cite): boolean {
    let path = this.router.url.split(/[?#]/)[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    return path === `/${readingCommands(place).join('/')}`;
  }

  private persistStack(): void {
    const raw = JSON.stringify(
      this.stack.map((frame) => ({
        documentId: documentIdKey(frame.documentId),
        unitIndex: frame.unitIndex,
      })),
    );
    this.sessionSet(STACK_STORAGE_KEY, raw);
  }

  private localStore(): StorageLike | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage;
    } catch {
      return null;
    }
  }

  private sessionGet(key: string): string | null {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private sessionSet(key: string, value: string): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(key, value);
    } catch {
      // quota / private mode
    }
  }
}
