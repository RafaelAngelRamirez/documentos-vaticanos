import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
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
export class LectorComponent implements OnDestroy {
  document: IndiceDocumentos | undefined = undefined;

  actual_articles: ArticleInfo[] = [];
  actual_index = 0;
  focus_article: ArticleInfo | undefined = undefined;
  quantity_to_load = 10;

  actual_inferior_limit = 0;
  actual_superior_limit = 0;

  loading = false;
  load_error: string | null = null;

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private navigationService: NavigationService,
    private cargarDocumentosJsonService: CargarDocumentosJsonService
  ) {
    this.sub.add(
      combineLatest([this.route.paramMap, this.route.url]).subscribe(() => {
        this.load_data();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
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

    // If we already have the full document in memory, use it.
    if (
      this.navigationService.document_selected &&
      (this.navigationService.document_selected.id === documentKey ||
        this.navigationService.document_selected.nombre === documentKey)
    ) {
      this.document = this.navigationService.document_selected;
      this.applyRoutePunto(routePunto);
      this.generate_context_for_article();
      return;
    }

    this.loading = true;
    this.load_error = null;
    this.sub.add(
      this.cargarDocumentosJsonService.ensureLoaded(documentKey).subscribe({
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
            err?.message ?? `No se pudo cargar el documento: ${documentKey}`;
          console.error(err);
        },
      })
    );
  }

  private applyRoutePunto(routePunto: string | null) {
    if (!this.document || routePunto == null || routePunto === '') {
      return;
    }

    // Prefer navigation index when it already matches a loaded article.
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
        return;
      }
    }

    const foundIdx = this.document.documento.findIndex(
      (a) => a.consecutivo === routePunto
    );
    if (foundIdx >= 0) {
      this.actual_index = foundIdx;
      this.navigationService.actual_index = foundIdx;
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
