import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import {
  EraListComponent,
  EraListGroup,
  EraListItem,
} from 'src/app/components/era-list/era-list.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { doctoresByEra, linkableWorks } from 'src/app/data/doctores';

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
    EraListComponent,
  ],
  templateUrl: './doctores.component.html',
  styleUrls: ['./doctores.component.css'],
})
export class DoctoresComponent {
  groups: EraListGroup[] = doctoresByEra().map((g) => ({
    era: g.era,
    items: g.items.map((d) => ({
      id: d.id,
      name: d.name,
      meta: d.meta,
      initials: d.initials,
      badge: linkableWorks(d).length > 0 ? ' · en corpus' : undefined,
    })),
  }));

  constructor(private router: Router) {}

  open(it: EraListItem): void {
    this.router.navigate(['/doctores', it.id]);
  }
}
