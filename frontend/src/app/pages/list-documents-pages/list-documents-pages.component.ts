import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import {
  catalogDisplayFor,
  catalogMetaLine,
} from 'src/app/core/corpus/catalog.display';

@Component({
  selector: 'app-list-documents-pages',
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent implements OnInit, OnDestroy {
  query = '';
  loading = false;
  load_error: string | null = null;
  private sub = new Subscription();

  constructor(
    public docService: CargarDocumentosJsonService,
    public navigationService: NavigationService,
    private router: Router,
    private corpus: CorpusService
  ) {}

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
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get filtered(): IndiceDocumentos[] {
    const all = this.docService.documentos_disponibles || [];
    const q = this.query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => {
      const title = this.displayTitle(item).toLowerCase();
      const meta = this.metaLine(item).toLowerCase();
      const short = (item.shortTitle || '').toLowerCase();
      return title.includes(q) || meta.includes(q) || short.includes(q);
    });
  }

  get sinResultados(): boolean {
    return (
      !this.loading &&
      !this.load_error &&
      (this.docService.documentos_disponibles?.length || 0) > 0 &&
      this.filtered.length === 0
    );
  }

  onQuery(ev: Event): void {
    this.query = (ev.target as HTMLInputElement).value;
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

  metaLine(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    return catalogMetaLine(catalogDisplayFor(item.id, meta?.kind));
  }

  goHome(): void {
    this.navigationService.go_to_search();
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
