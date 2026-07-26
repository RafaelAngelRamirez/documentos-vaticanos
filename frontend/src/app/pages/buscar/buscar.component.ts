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
 * PR5: also accepts `?mode=topic&slug=gracia` (or `topic=`) deep links.
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
      // Typing clears forced topic opts from the route snapshot (user overrides).
      this.buscadorService.buscar(v);
    });

    const qp = this.route.snapshot.queryParamMap;
    const q = qp.get('q');
    const mode = qp.get('mode');
    const slug = qp.get('slug') || qp.get('topic');
    const display =
      q ||
      (mode === 'topic' && slug ? `tema:${slug}` : slug) ||
      '';

    if (display || mode === 'topic' || slug) {
      this.control.setValue(display, { emitEvent: false });
      this.buscadorService.buscar(display || null, { mode, slug, topic: qp.get('topic') });
    }
  }

  goLib(): void {
    this.navigation.go_to_documents();
  }
}
