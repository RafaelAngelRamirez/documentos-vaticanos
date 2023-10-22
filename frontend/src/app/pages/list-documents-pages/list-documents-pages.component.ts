import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import {
  CargarDocumentosJsonService,
  Article,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';

@Component({
  selector: 'app-list-documents-pages',
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent {
  constructor(
    public buscadorService: BuscadorService,
    public docService: CargarDocumentosJsonService,
    public navigationService: NavigationService,
    private router: Router
  ) {}

  keys = Object.keys;
  catecismo: Article[] = [];

  ngOnInit(): void {}

  read(item: IndiceDocumentos) {
    this.navigationService.document_selected = item;
    this.navigationService.actual_index = 0;
    this.navigationService.article_selected = undefined;

    this.router.navigate([ROUTE.leyendo, item.nombre, ROUTE.punto, 0]);
  }
}
