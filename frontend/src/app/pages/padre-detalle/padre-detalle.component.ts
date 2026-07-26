import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
import {
  PersonFichaComponent,
  PersonWorkLink,
} from 'src/app/components/person-ficha/person-ficha.component';
import { Padre, padreById } from 'src/app/data/padres';
import { HistoricalContextService } from 'src/app/core/context/historical-context.service';
import { ResolvedHistoricalContext } from 'src/app/core/context/historical-context.models';

/** Diseño 2D · Detalle de un Padre */
@Component({
  standalone: true,
  selector: 'app-padre-detalle',
  imports: [
    CommonModule,
    RouterModule,
    PersonFichaComponent,
    HistoricalContextBlockComponent,
  ],
  templateUrl: './padre-detalle.component.html',
  styleUrls: ['./padre-detalle.component.css'],
})
export class PadreDetalleComponent implements OnInit {
  padre: Padre | null = null;
  historicalContext: ResolvedHistoricalContext | null = null;
  works: PersonWorkLink[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private historical: HistoricalContextService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.padre = padreById(id) || null;
    if (!this.padre) {
      this.router.navigate(['/padres']);
      return;
    }
    this.works = (this.padre.works || []).map((w) => ({
      title: w.title,
      documentId: w.documentId,
    }));
    // Same offline author profiles as santoral when ids align (e.g. agustin-hipona).
    this.historical.contextForSaint(this.padre.id).subscribe({
      next: (ctx) => {
        this.historicalContext = ctx;
      },
      error: () => {
        this.historicalContext = null;
      },
    });
  }

  get kindLine(): string {
    if (!this.padre) return '';
    return [this.padre.eraLabel, this.padre.years].filter(Boolean).join(' · ');
  }
}
