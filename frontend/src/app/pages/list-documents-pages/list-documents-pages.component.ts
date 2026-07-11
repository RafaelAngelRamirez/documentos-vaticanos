import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';

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
    private router: Router
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
