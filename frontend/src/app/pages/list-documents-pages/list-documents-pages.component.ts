import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';

@Component({
  selector: 'app-list-documents-pages',
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent implements OnInit, OnDestroy {
  constructor(
    public buscadorService: BuscadorService,
    public docService: CargarDocumentosJsonService,
    public navigationService: NavigationService,
    private router: Router,
    private corpus: CorpusService
  ) {}

  keys = Object.keys;
  loading = false;
  load_error: string | null = null;
  private sub = new Subscription();

  ngOnInit(): void {
    this.loading = true;
    this.sub.add(
      this.docService.ensureAllLoaded().subscribe({
        next: () => {
          this.loading = false;
          this.load_error = null;
        },
        error: (err) => {
          this.loading = false;
          this.load_error =
            err?.message ?? 'No se pudieron cargar los documentos.';
          console.error(err);
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  displayTitle(item: IndiceDocumentos): string {
    return (
      item.title ||
      item.nombre ||
      this.corpus.getMeta(item.id || '')?.title ||
      item.id ||
      'Documento'
    );
  }

  shortLabel(item: IndiceDocumentos): string | null {
    const short =
      item.shortTitle || this.corpus.getMeta(item.id || '')?.shortTitle;
    const full = this.displayTitle(item);
    if (!short || short === full) return null;
    return short;
  }

  localeLabel(item: IndiceDocumentos): string {
    const locale =
      item.locale || this.corpus.getMeta(item.id || '')?.locale || 'es';
    return CorpusService.localeLabel(locale);
  }

  sourceUrl(item: IndiceDocumentos): string | null {
    return item.sourceUrl || this.corpus.getMeta(item.id || '')?.sourceUrl || null;
  }

  read(item: IndiceDocumentos) {
    this.navigationService.document_selected = item;
    this.navigationService.document_id = item.id ?? item.nombre;
    this.navigationService.actual_index = 0;
    this.navigationService.article_selected = undefined;
    this.navigationService.save_actual_index();

    this.router.navigate([
      ROUTE.leyendo,
      this.navigationService.document_id,
      ROUTE.punto,
      0,
    ]);
  }
}
