import { Component, OnInit } from '@angular/core';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import {
  CargarDocumentosJsonService,
  Punto,
} from 'src/app/services/cargar-documentos-json.service';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
})
export class InicioComponent implements OnInit {
  constructor(
    public buscadorService: BuscadorService,
    public docService: CargarDocumentosJsonService
  ) {}

  catecismo: Punto[] = [];

  ngOnInit(): void {}
}
