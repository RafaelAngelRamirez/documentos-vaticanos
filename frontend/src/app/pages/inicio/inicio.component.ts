import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import { PuntoModule } from 'src/app/components/punto/punto.module';
import {
  CargarDocumentosJsonService,
  Article,
} from 'src/app/services/cargar-documentos-json.service';

@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule, PuntoModule, BuscadorComponent],
})
export class InicioComponent implements OnInit {
  constructor(
    public buscadorService: BuscadorService,
    public docService: CargarDocumentosJsonService
  ) {}

  keys = Object.keys;
  catecismo: Article[] = [];

  ngOnInit(): void {}
}
