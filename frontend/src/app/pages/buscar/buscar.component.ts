import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';

/**
 * Full-text search (app feature beyond the design catalog filter).
 * Reached from Biblioteca → "Buscar en el texto".
 */
@Component({
  standalone: true,
  selector: 'app-buscar',
  templateUrl: './buscar.component.html',
  styleUrls: ['./buscar.component.css'],
  imports: [CommonModule, BuscadorComponent, ReactiveFormsModule],
})
export class BuscarComponent {
  control = new FormControl('', { nonNullable: true });

  constructor(
    public buscadorService: BuscadorService,
    private navigation: NavigationService
  ) {
    // Keep global control in sync (legacy consumers / deep links).
    this.buscadorService.global_control_search_input = this.control;
    this.control.valueChanges.pipe(debounceTime(400)).subscribe((v) => {
      this.buscadorService.buscar(v);
    });
  }

  goLib(): void {
    this.navigation.go_to_documents();
  }

  runExample(q: string): void {
    this.control.setValue(q);
    this.buscadorService.global_control_search_input?.setValue(q);
  }

  get hasQuery(): boolean {
    const t = this.buscadorService.terminos;
    return Boolean(t.terminos?.length || t.puntos?.length);
  }
}
