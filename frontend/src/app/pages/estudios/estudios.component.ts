import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { Study, StudiesService } from 'src/app/core/account/studies.service';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  selector: 'app-estudios',
  imports: [CommonModule, RouterModule],
  templateUrl: './estudios.component.html',
  styleUrls: ['./estudios.component.css'],
})
export class EstudiosComponent implements OnInit {
  published: Study[] = [];
  mine: Study[] = [];
  enrolled: Study[] = [];
  loading = false;
  error: string | null = null;
  apiEnabled = Boolean(environment.apiBaseUrl);

  constructor(
    public auth: AuthService,
    private studies: StudiesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.apiEnabled) {
      this.error = 'API no configurada';
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.studies.listPublished().subscribe({
      next: (items) => {
        this.published = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error al cargar estudios';
      },
    });
    if (this.auth.isTeacher) {
      this.studies.listMine().subscribe({
        next: (items) => (this.mine = items),
        error: () => undefined,
      });
    }
    if (this.auth.isLoggedIn) {
      this.studies.myEnrollments().subscribe({
        next: (items) => {
          this.enrolled = items
            .map((e) => e.study)
            .filter((s): s is Study => Boolean(s));
        },
        error: () => undefined,
      });
    }
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

  cover(s: Study): string | null {
    return this.studies.coverUrl(s);
  }
}
