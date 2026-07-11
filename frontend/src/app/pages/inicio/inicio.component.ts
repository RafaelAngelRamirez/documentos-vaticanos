import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import { PuntoModule } from 'src/app/components/punto/punto.module';

@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule, PuntoModule, BuscadorComponent],
})
export class InicioComponent implements OnInit {
  constructor(public buscadorService: BuscadorService) {}

  keys = Object.keys;

  ngOnInit(): void {}

  first_view(): any {
    return !(
      this.buscadorService.terminos.puntos ||
      this.buscadorService.terminos.terminos
    );
  }

  help_many_terms() {
    this.buscadorService.global_control_search_input.setValue(
      'muerte, resurección'
    );
  }

  help_many_dots() {
    this.buscadorService.global_control_search_input.setValue(
      '.100-105, .299-300'
    );
  }

  help_mixed_terms() {
    this.buscadorService.global_control_search_input.setValue(
      'jesucristo, .100-105, .299-300'
    );
  }
}
