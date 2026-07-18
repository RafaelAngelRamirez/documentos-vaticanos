import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { HistoricalContextBlockComponent } from 'src/app/components/historical-context-block/historical-context-block.component';
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
    WbarComponent,
    HistoricalContextBlockComponent,
  ],
  templateUrl: './padre-detalle.component.html',
  styleUrls: ['./padre-detalle.component.css'],
})
export class PadreDetalleComponent implements OnInit {
  padre: Padre | null = null;
  historicalContext: ResolvedHistoricalContext | null = null;

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
}
