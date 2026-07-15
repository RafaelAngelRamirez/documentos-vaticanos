import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { ActivatedRoute } from '@angular/router';
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
    private navigation: NavigationService,
    private route: ActivatedRoute
  ) {
    // Keep global control in sync (legacy consumers / deep links).
    this.buscadorService.global_control_search_input = this.control;
    this.control.valueChanges.pipe(debounceTime(400)).subscribe((v) => {
      this.buscadorService.buscar(v);
    });
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.control.setValue(q);
      this.buscadorService.buscar(q);
    }
  }

  goLib(): void {
    this.navigation.go_to_documents();
  }
}
