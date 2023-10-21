import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import {
  Article,
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
export class LectorComponent {
  document: IndiceDocumentos | undefined = undefined;

  actual_articles: ArticleInfo[] = [];
  actual_index = 0;
  focus_article: ArticleInfo | undefined = undefined;
  quantity_to_load = 10;

  actual_inferior_limit = 0;
  actual_superior_limit = 0;

  constructor(
    route: ActivatedRoute,
    private navigationService: NavigationService,
    private cargarDocumentosJsonService: CargarDocumentosJsonService
  ) {
    const id: Observable<string> = route.params.pipe(map((p) => p['id']));

    const url: Observable<string> = route.url.pipe(
      map((segments) => segments.join('/'))
    );

    url.subscribe((ur) => {
      console.log({ ur });
      this.load_data();
    });
  }

  load_data() {
    this.document = this.navigationService.document_selected;
    this.actual_index = this.navigationService.actual_index;
    this.focus_article = this.navigationService.article_selected;

    this.generate_context_for_article();
  }

  /**
   *The context for the article is nothing more
   * than the n before and after articles indexed
   * in the document.
   *
   * @memberof LectorComponent
   */
  generate_context_for_article() {
    let inferior_limit = this.actual_index - CONTEXT_SIZE;
    inferior_limit = inferior_limit < 1 ? 0 : inferior_limit;

    const document_length = this.document?.documento.length ?? 0;
    let superior_limit = this.actual_index + CONTEXT_SIZE;
    superior_limit =
      superior_limit <= document_length ? superior_limit : document_length;

    // For purpose of facility, we are goin to save this en the component
    // scope. (Check load_* functions)
    this.actual_inferior_limit = inferior_limit;
    this.actual_superior_limit = superior_limit;

    // For UX we going to add search terms.
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

    // We need "ArticleInfo" not "Article" to show article
    // in app-punto component.
    return articles.map((article) => {
      return { article, terms_pure: [] } as ArticleInfo;
    });
  }

  load_before() {
    console.log('Estamos load');
    // Never can be negative.
    let new_inferior_limit = this.actual_inferior_limit - this.quantity_to_load;
    if (new_inferior_limit < 0) new_inferior_limit = 0;
    this.actual_inferior_limit = new_inferior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );
  }

  load_next() {
    console.log('Estamos load next');
    // Never can be negative.
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
