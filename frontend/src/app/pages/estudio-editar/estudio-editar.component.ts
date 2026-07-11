import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { Study, StudiesService } from 'src/app/core/account/studies.service';

@Component({
  standalone: true,
  selector: 'app-estudio-editar',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './estudio-editar.component.html',
  styleUrls: ['./estudio-editar.component.css'],
})
export class EstudioEditarComponent implements OnInit {
  study: Study | null = null;
  loading = false;
  error: string | null = null;
  message: string | null = null;
  uploading = false;

  metaForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  stepForm = new FormGroup({
    documentId: new FormControl('cic-es', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unitIndex: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    unitLabel: new FormControl('', { nonNullable: true }),
    teacherNote: new FormControl('', { nonNullable: true }),
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private studies: StudiesService
  ) {}

  ngOnInit(): void {
    if (!this.auth.isTeacher) {
      this.router.navigate(['/cuenta']);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/estudios']);
      return;
    }
    this.load(id);
  }

  load(id: string): void {
    this.loading = true;
    this.studies.get(id).subscribe({
      next: (s) => {
        if (s.teacherId !== this.auth.user?.id) {
          this.error = 'No eres el dueño de este estudio';
          this.loading = false;
          return;
        }
        this.study = s;
        this.metaForm.patchValue({
          title: s.title,
          description: s.description || '',
        });
        this.loading = false;
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

  saveMeta(): void {
    if (!this.study || !this.metaForm.valid) return;
    const v = this.metaForm.getRawValue();
    this.studies
      .update(this.study.id, {
        title: v.title,
        description: v.description,
      })
      .subscribe({
        next: (s) => {
          this.study = s;
          this.message = 'Guardado';
        },
        error: (err) => {
          this.error = err?.error?.error || err?.message || 'Error';
        },
      });
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.study) return;
    this.uploading = true;
    this.studies.uploadImage(file).subscribe({
      next: (up) => {
        this.studies
          .update(this.study!.id, { coverImageKey: up.key })
          .subscribe({
            next: (s) => {
              this.study = s;
              this.uploading = false;
              this.message = `Portada optimizada (${Math.round(up.bytes / 1024)} KB)`;
            },
            error: (err) => {
              this.uploading = false;
              this.error = err?.error?.error || err?.message || 'Error al asociar imagen';
            },
          });
      },
      error: (err) => {
        this.uploading = false;
        this.error = err?.error?.error || err?.message || 'Error al subir';
      },
    });
  }

  addStep(): void {
    if (!this.study || !this.stepForm.valid) return;
    const v = this.stepForm.getRawValue();
    const steps = [
      ...(this.study.steps || []).map((s) => ({
        documentId: s.documentId,
        unitIndex: s.unitIndex,
        unitLabel: s.unitLabel ?? undefined,
        teacherNote: s.teacherNote ?? undefined,
      })),
      {
        documentId: v.documentId.trim(),
        unitIndex: Number(v.unitIndex),
        unitLabel: v.unitLabel || undefined,
        teacherNote: v.teacherNote || undefined,
      },
    ];
    this.studies.setSteps(this.study.id, steps).subscribe({
      next: (s) => {
        this.study = s;
        this.stepForm.patchValue({ unitLabel: '', teacherNote: '' });
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  removeStep(i: number): void {
    if (!this.study) return;
    const steps = (this.study.steps || [])
      .filter((_, idx) => idx !== i)
      .map((s) => ({
        documentId: s.documentId,
        unitIndex: s.unitIndex,
        unitLabel: s.unitLabel ?? undefined,
        teacherNote: s.teacherNote ?? undefined,
      }));
    this.studies.setSteps(this.study.id, steps).subscribe({
      next: (s) => (this.study = s),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  publish(): void {
    if (!this.study) return;
    this.studies.publish(this.study.id).subscribe({
      next: (s) => {
        this.study = s;
        this.message = 'Estudio publicado';
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo publicar';
      },
    });
  }

  archive(): void {
    if (!this.study) return;
    this.studies.archive(this.study.id).subscribe({
      next: (s) => {
        this.study = s;
        this.message = 'Estudio archivado';
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }
}
