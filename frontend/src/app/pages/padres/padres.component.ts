import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Padre, padresByEra } from 'src/app/data/padres';

/** Diseño 2C · Padres de la Iglesia */
@Component({
  standalone: true,
  selector: 'app-padres',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './padres.component.html',
  styleUrls: ['./padres.component.css'],
})
export class PadresComponent {
  groups = padresByEra();

  constructor(private router: Router) {}

  open(p: Padre): void {
    this.router.navigate(['/padres', p.id]);
  }
}
