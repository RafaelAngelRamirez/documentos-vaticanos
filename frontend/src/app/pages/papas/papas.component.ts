import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import {
  EraListComponent,
  EraListGroup,
  EraListItem,
} from 'src/app/components/era-list/era-list.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { PapacyService } from 'src/app/core/papacy/papacy.service';
import {
  filterPopes,
  initialsForPope,
  popesByEra,
} from 'src/app/core/papacy/papacy-resolve.logic';
import { PopeRecord } from 'src/app/core/papacy/papacy.models';

/** Lista de pontífices (plantilla 2C, misma que Padres / Santoral). */
@Component({
  standalone: true,
  selector: 'app-papas',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
    EraListComponent,
  ],
  templateUrl: './papas.component.html',
  styleUrls: ['./papas.component.css'],
})
export class PapasComponent implements OnInit {
  all: PopeRecord[] = [];
  groups: EraListGroup[] = [];
  loading = true;
  error: string | null = null;
  total = 0;
  filter = '';
  saintCount = 0;
  corpusCount = 0;

  constructor(
    private papacy: PapacyService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.papacy.loadManifest().subscribe({
      next: () => {
        this.all = this.papacy.listPopes();
        this.total = this.all.length;
        this.saintCount = this.all.filter((p) => p.saintId).length;
        this.corpusCount = this.all.filter(
          (p) => (p.documentIds || []).length > 0,
        ).length;
        this.rebuild();
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el pack de pontífices.';
        this.loading = false;
      },
    });
  }

  onFilter(ev: Event): void {
    const el = ev.target as HTMLInputElement | null;
    this.filter = el?.value || '';
    this.rebuild();
  }

  rebuild(): void {
    const filtered = filterPopes(this.all, this.filter);
    this.groups = popesByEra(filtered).map((g) => ({
      era: g.era,
      items: g.items.map((p) => {
        const nDocs = (p.documentIds || []).length;
        return {
          id: p.id,
          name: p.displayName || p.name,
          meta: p.meta || p.years || '',
          initials: initialsForPope(p),
          badge: nDocs
            ? ` · ${nDocs} en corpus`
            : p.saintId
              ? ' · santoral'
              : undefined,
        };
      }),
    }));
  }

  open(it: EraListItem): void {
    this.router.navigate(['/papas', it.id]);
  }
}
