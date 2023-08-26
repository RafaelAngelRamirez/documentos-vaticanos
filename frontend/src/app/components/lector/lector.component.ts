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

    let articles =
      this.document?.documento.slice(inferior_limit, superior_limit) ?? [];

    // We need "ArticleInfo" not "Article" to show article
    // in app-punto component.
    this.actual_articles = articles.map((article) => {
      return { article, terms_pure: [] } as ArticleInfo;
    });

    // For UX we going to add search terms.

    const actual_article_in_list = this.actual_articles.find(
      (article) => article.article.index_array === this.actual_index
    );

    if (actual_article_in_list) {
      actual_article_in_list.termns = this.focus_article?.termns;
      actual_article_in_list.terms_pure = this.focus_article?.terms_pure ?? [];
    }
  }
}
