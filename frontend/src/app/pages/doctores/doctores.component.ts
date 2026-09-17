import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import {
  EraListComponent,
  EraListGroup,
  EraListItem,
} from 'src/app/components/era-list/era-list.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
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
export class DoctoresComponent implements OnInit, OnDestroy {
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
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  open(it: EraListItem): void {
    this.router.navigate(['/doctores', it.id]);
  }
}
