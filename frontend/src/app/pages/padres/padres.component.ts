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
import { padresByEra } from 'src/app/data/padres';

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
    EraListComponent,
  ],
  templateUrl: './padres.component.html',
  styleUrls: ['./padres.component.css'],
})
export class PadresComponent {
  groups: EraListGroup[] = padresByEra().map((g) => ({
    era: g.era,
    items: g.items.map((p) => ({
      id: p.id,
      name: p.name,
      meta: p.meta,
      initials: p.initials,
    })),
  }));

  constructor(private router: Router) {}

  open(it: EraListItem): void {
    this.router.navigate(['/padres', it.id]);
  }
}
