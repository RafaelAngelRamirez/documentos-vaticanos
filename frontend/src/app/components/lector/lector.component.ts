import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  ReaderPreferences,
  ReaderPreferencesService,
} from 'src/app/services/reader-preferences.service';
import { ArticleInfo } from '../punto/punto/punto.component';
import { PuntoModule } from '../punto/punto.module';

const CONTEXT_SIZE = 5;

@Component({
  selector: 'app-lector',
  standalone: true,
  imports: [CommonModule, PuntoModule],
  templateUrl: './lector.component.html',
  styleUrls: ['./lector.component.css'],
})
export class LectorComponent implements OnInit, OnDestroy {
  document: IndiceDocumentos | undefined = undefined;

  actual_articles: ArticleInfo[] = [];
  actual_index = 0;
  focus_article: ArticleInfo | undefined = undefined;
  quantity_to_load = 10;

  actual_inferior_limit = 0;
  actual_superior_limit = 0;

  loading = false;
  load_error: string | null = null;

  prefsOpen = false;
  prefs: ReaderPreferences = this.readerPrefs.snapshot;

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    public navigationService: NavigationService,
    private cargarDocumentosJsonService: CargarDocumentosJsonService,
    private readerPrefs: ReaderPreferencesService
  ) {
    this.sub.add(
      combineLatest([this.route.paramMap, this.route.url]).subscribe(() => {
        this.load_data();
      })
    );
  }

  ngOnInit(): void {
    this.readerPrefs.applyToDom();
    this.sub.add(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get documentTitle(): string {
    return this.document?.nombre ?? this.document?.id ?? '';
  }

  get canLoadBefore(): boolean {
    return this.actual_inferior_limit > 0;
  }

  get canLoadNext(): boolean {
    const len = this.document?.documento.length ?? 0;
    return this.actual_superior_limit < len;
  }

  goBackFromRef(): void {
    this.navigationService.goBack();
  }

  goToSearch(): void {
    this.navigationService.go_to_search();
  }

  togglePrefs(): void {
    this.prefsOpen = !this.prefsOpen;
  }

  decreaseFont(): void {
    this.readerPrefs.bumpFontSize(-1);
  }

  increaseFont(): void {
    this.readerPrefs.bumpFontSize(1);
  }

  cycleTheme(): void {
    this.readerPrefs.cycleTheme();
  }

  cycleFont(): void {
    this.readerPrefs.cycleFont();
  }

  resetPrefs(): void {
    this.readerPrefs.reset();
  }

  themeLabel(theme: ReaderPreferences['theme']): string {
    switch (theme) {
      case 'paper':
        return 'Papel';
      case 'sepia':
        return 'Sepia';
      case 'night':
        return 'Noche';
      case 'system':
        return 'Sistema';
      default:
        return theme;
    }
  }

  fontLabel(font: ReaderPreferences['font']): string {
    return font === 'serif' ? 'Serif' : 'Sans';
  }

  load_data() {
    this.actual_index = this.navigationService.actual_index;
    this.focus_article = this.navigationService.article_selected;

    const routeDoc =
      this.route.snapshot.paramMap.get('documento') ??
      this.route.snapshot.paramMap.get('id');
    const routePunto = this.route.snapshot.paramMap.get('user');

    const documentKey =
      this.navigationService.document_selected?.id ??
      this.navigationService.document_selected?.nombre ??
      this.navigationService.document_id ??
      routeDoc ??
      undefined;

    if (!documentKey) {
      this.load_error =
        'No hay documento seleccionado. Vuelve al listado o a la búsqueda.';
      this.document = undefined;
      this.actual_articles = [];
      return;
    }

    // Prefer the route document when it differs from the in-memory selection
    // (e.g. following a cross-document reference).
    const effectiveKey = routeDoc ?? documentKey;

    // If we already have the full document in memory, use it.
    if (
      this.navigationService.document_selected &&
      (this.navigationService.document_selected.id === effectiveKey ||
        this.navigationService.document_selected.nombre === effectiveKey)
    ) {
      this.document = this.navigationService.document_selected;
      this.navigationService.document_id =
        this.document.id ?? this.document.nombre;
      this.applyRoutePunto(routePunto);
      this.generate_context_for_article();
      return;
    }

    this.loading = true;
    this.load_error = null;
    this.sub.add(
      this.cargarDocumentosJsonService.ensureLoaded(effectiveKey).subscribe({
        next: (doc) => {
          this.loading = false;
          this.document = doc;
          this.navigationService.document_selected = doc;
          this.navigationService.document_id = doc.id ?? doc.nombre;
          this.applyRoutePunto(routePunto);
          this.generate_context_for_article();
        },
        error: (err) => {
          this.loading = false;
          this.load_error =
            err?.message ?? `No se pudo cargar el documento: ${effectiveKey}`;
          console.error(err);
        },
      })
    );
  }

  private applyRoutePunto(routePunto: string | null) {
    if (!this.document || routePunto == null || routePunto === '') {
      return;
    }

    // Prefer navigationService.actual_index when it already points at an article
    // consistent with the route (set by navigateToUnit / go_to_read_article).
    const navIdx = this.navigationService.actual_index;
    const atNav = this.document.documento[navIdx];
    if (atNav) {
      const matchesRoute =
        String(navIdx) === String(routePunto) ||
        atNav.consecutivo === routePunto ||
        String(atNav.index_array) === String(routePunto);
      if (matchesRoute) {
        this.actual_index = navIdx;
        // Keep focus_article only when it still refers to this unit.
        if (
          this.focus_article &&
          this.focus_article.article?.index_array !== atNav.index_array
        ) {
          this.focus_article = undefined;
        }
        return;
      }
    }

    // Prefer navigation index when focus_article already matches a loaded article.
    if (
      this.focus_article &&
      this.document.documento[this.actual_index]?.index_array ===
        this.focus_article.article?.index_array
    ) {
      return;
    }

    const asNumber = Number(routePunto);
    if (!Number.isNaN(asNumber) && String(asNumber) === String(routePunto)) {
      if (this.document.documento[asNumber]) {
        this.actual_index = asNumber;
        this.navigationService.actual_index = asNumber;
        this.focus_article = undefined;
        return;
      }
    }

    const foundIdx = this.document.documento.findIndex(
      (a) => a.consecutivo === routePunto
    );
    if (foundIdx >= 0) {
      this.actual_index = foundIdx;
      this.navigationService.actual_index = foundIdx;
      this.focus_article = undefined;
    }
  }

  /**
   * The context for the article is the n articles before and after
   * the focused index in the document.
   */
  generate_context_for_article() {
    let inferior_limit = this.actual_index - CONTEXT_SIZE;
    inferior_limit = inferior_limit < 1 ? 0 : inferior_limit;

    const document_length = this.document?.documento.length ?? 0;
    let superior_limit = this.actual_index + CONTEXT_SIZE;
    superior_limit =
      superior_limit <= document_length ? superior_limit : document_length;

    this.actual_inferior_limit = inferior_limit;
    this.actual_superior_limit = superior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );

    const actual_article_in_list = this.actual_articles.find(
      (article) => article.article.index_array === this.actual_index
    );

    if (actual_article_in_list) {
      actual_article_in_list.termns = this.focus_article?.termns;
      actual_article_in_list.terms_pure = this.focus_article?.terms_pure ?? [];
    }

    // Keep navigation service in sync for subsequent ref pushes.
    this.navigationService.actual_index = this.actual_index;
    if (this.document) {
      this.navigationService.document_id =
        this.document.id ?? this.document.nombre;
    }
    this.navigationService.save_actual_index();
  }

  private _get_articles(inferior_limit = 0, superior_limit = 0) {
    let articles =
      this.document?.documento.slice(inferior_limit, superior_limit) ?? [];

    return articles.map((article) => {
      return { article, terms_pure: [] } as ArticleInfo;
    });
  }

  load_before() {
    let new_inferior_limit = this.actual_inferior_limit - this.quantity_to_load;
    if (new_inferior_limit < 0) new_inferior_limit = 0;
    this.actual_inferior_limit = new_inferior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );
  }

  load_next() {
    let new_superior_limit = this.actual_superior_limit + this.quantity_to_load;

    const document_size = this.document?.documento.length ?? 0;

    if (new_superior_limit > document_size) new_superior_limit = document_size;
    this.actual_superior_limit = new_superior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );
  }
}
