import { Component, OnInit } from '@angular/core';
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
  constructor(public docService: CargarDocumentosJsonService) {}

  catecismo: Punto[] = [];

  ngOnInit(): void {
  }
}
