import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { Study, StudiesService } from 'src/app/core/account/studies.service';
import { environment } from 'src/environments/environment';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import {
  LastRead,
  ReadingProgressService,
} from 'src/app/services/reading-progress.service';
import { ROUTE } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-estudios',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './estudios.component.html',
  styleUrls: ['./estudios.component.css'],
})
export class EstudiosComponent implements OnInit {
  plans: Study[] = [];
  loading = false;
  error: string | null = null;
  apiEnabled = Boolean(environment.apiBaseUrl);
  lastRead: LastRead | null = null;
  topicChips = ['Fe', 'Liturgia', 'Oración', 'Moral', 'Doctrina social'];

  constructor(
    public auth: AuthService,
    private studies: StudiesService,
    private router: Router,
    private progress: ReadingProgressService
  ) {}

  ngOnInit(): void {
    this.lastRead = this.progress.getLastRead();
    if (!this.apiEnabled) {
      this.error = null;
      return;
    }
    this.reload();
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get progressPct(): number {
    return this.progress.percent(this.lastRead);
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.studies.listPublished().subscribe({
      next: (items) => {
        this.plans = items;
        this.loading = false;
        if (this.auth.isTeacher) {
          this.studies.listMine().subscribe({
            next: (mine) => {
              const ids = new Set(this.plans.map((p) => p.id));
              for (const m of mine) {
                if (!ids.has(m.id)) this.plans = [m, ...this.plans];
              }
            },
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.error || err?.message || 'Error al cargar estudios';
      },
    });
  }

  initials(title: string | undefined): string {
    if (!title?.trim()) return '·';
    return title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  continueReading(): void {
    if (!this.lastRead) return;
    this.router.navigate([
      ROUTE.leyendo,
      this.lastRead.documentId,
      ROUTE.punto,
      this.lastRead.unitIndex,
    ]);
  }

  continueWithNarrator(): void {
    try {
      sessionStorage.setItem('dv.autoNarr', '1');
    } catch {
      // ignore
    }
    this.continueReading();
  }

  goLibrary(): void {
    this.router.navigate(['/biblioteca']);
  }

  open(s: Study): void {
    this.router.navigate(['/estudios', s.id]);
  }

  createMine(): void {
    if (!this.auth.isTeacher) {
      this.router.navigate(['/cuenta']);
      return;
    }
    this.studies.create({ title: 'Nuevo estudio' }).subscribe({
      next: (s) => this.router.navigate(['/estudios', s.id, 'editar']),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo crear';
      },
    });
  }

  chipSearch(term: string): void {
    this.router.navigate(['/buscar'], { queryParams: { q: term } });
  }
}
