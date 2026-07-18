import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Doctor, doctoresByEra, linkableWorks } from 'src/app/data/doctores';

/** Listado de Doctores de la Iglesia (patrón 2C como Padres). */
@Component({
  standalone: true,
  selector: 'app-doctores',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './doctores.component.html',
  styleUrls: ['./doctores.component.css'],
})
export class DoctoresComponent {
  groups = doctoresByEra();

  constructor(private router: Router) {}

  open(d: Doctor): void {
    this.router.navigate(['/doctores', d.id]);
  }

  hasLinkedWorks(d: Doctor): boolean {
    return linkableWorks(d).length > 0;
  }
}
