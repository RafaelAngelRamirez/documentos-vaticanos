import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import {
  Enrollment,
  Study,
  StudiesService,
} from 'src/app/core/account/studies.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-estudio-detalle',
  imports: [CommonModule, RouterModule],
  templateUrl: './estudio-detalle.component.html',
  styleUrls: ['./estudio-detalle.component.css'],
})
export class EstudioDetalleComponent implements OnInit {
  study: Study | null = null;
  students: Enrollment[] = [];
  loading = false;
  error: string | null = null;
  message: string | null = null;
  enrolled = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private studies: StudiesService,
    private nav: NavigationService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/estudios']);
      return;
    }
    this.load(id);
  }

  get isOwner(): boolean {
    return (
      !!this.study &&
      !!this.auth.user &&
      this.study.teacherId === this.auth.user.id
    );
  }

  load(id: string): void {
    this.loading = true;
    this.studies.get(id).subscribe({
      next: (s) => {
        this.study = s;
        this.loading = false;
        if (this.isOwner) {
          this.studies.students(id).subscribe({
            next: (items) => (this.students = items),
          });
        }
        if (this.auth.isLoggedIn) {
          this.studies.myEnrollments().subscribe({
            next: (items) => {
              this.enrolled = items.some((e) => e.studyId === id);
            },
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  cover(): string | null {
    return this.study ? this.studies.coverUrl(this.study) : null;
  }

  enroll(): void {
    if (!this.study) return;
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/cuenta']);
      return;
    }
    this.studies.enroll(this.study.id).subscribe({
      next: () => {
        this.enrolled = true;
        this.message = 'Inscripción realizada';
        this.load(this.study!.id);
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo inscribir';
      },
    });
  }

  openStep(documentId: string, unitIndex: number, label?: string | null): void {
    this.nav.navigateToUnit(documentId, unitIndex, {
      label: label ?? undefined,
    });
  }
}
