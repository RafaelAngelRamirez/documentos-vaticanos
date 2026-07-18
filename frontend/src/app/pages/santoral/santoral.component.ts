import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';

/** Lista del santoral offline (vidas + obras del corpus). */
@Component({
  standalone: true,
  selector: 'app-santoral',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './santoral.component.html',
  styleUrls: ['./santoral.component.css'],
})
export class SantoralComponent implements OnInit {
  groups: { era: string; items: SaintRecord[] }[] = [];
  loading = true;
  error: string | null = null;
  total = 0;

  constructor(
    private santoral: SantoralService,
    private corpus: CorpusService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.corpus.loadManifest().subscribe({
      next: () => {
        this.santoral.loadManifest().subscribe({
          next: (m) => {
            this.groups = this.santoral.groupsByEra();
            this.total = m.saints?.length || 0;
            this.loading = false;
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.message || 'No se pudo cargar el santoral.';
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'No se pudo cargar el catálogo.';
      },
    });
  }

  open(s: SaintRecord): void {
    this.router.navigate(['/santoral', s.id]);
  }

  label(s: SaintRecord): string {
    return s.displayName || s.name;
  }

  sub(s: SaintRecord): string {
    if (s.meta) return s.meta;
    const n = this.santoral.worksForSaint(s).length;
    const parts = [s.years, s.role, n ? `${n} obras` : null].filter(Boolean);
    return parts.join(' · ');
  }

  initials(s: SaintRecord): string {
    if (s.initials) return s.initials;
    const n = (s.displayName || s.name || '?').replace(
      /^(San|Santa|Santo|Beato|Beata)\s+/i,
      '',
    );
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
}
