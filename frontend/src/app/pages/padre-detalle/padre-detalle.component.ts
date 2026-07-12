import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Padre, padreById } from 'src/app/data/padres';

/** Diseño 2D · Detalle de un Padre */
@Component({
  standalone: true,
  selector: 'app-padre-detalle',
  imports: [CommonModule, RouterModule, WbarComponent],
  templateUrl: './padre-detalle.component.html',
  styleUrls: ['./padre-detalle.component.css'],
})
export class PadreDetalleComponent implements OnInit {
  padre: Padre | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.padre = padreById(id) || null;
    if (!this.padre) {
      this.router.navigate(['/padres']);
    }
  }
}
