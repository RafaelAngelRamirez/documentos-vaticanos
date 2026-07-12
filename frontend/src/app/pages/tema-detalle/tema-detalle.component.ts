import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  Theme,
  ThemeReviewStatus,
  ThemesService,
} from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { StudiesService } from 'src/app/core/account/studies.service';
import { environment } from 'src/environments/environment';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';

/**
 * Diseño 3I · Tema (lector)
 * 4C · Tema de maestro (compartido + descarga)
 * 4D · Publicar tema
 * 5G · Web tema maestro
 * 6B · Cambios solicitados
 */
@Component({
  standalone: true,
  selector: 'app-tema-detalle',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, WbarComponent],
  templateUrl: './tema-detalle.component.html',
  styleUrls: ['./tema-detalle.component.css'],
})
export class TemaDetalleComponent implements OnInit {
  theme: Theme | null = null;
  loading = false;
  error: string | null = null;
  message: string | null = null;
  uploading = false;
  busy = false;
  /** UI mode: read | publish (4D form) */
  mode: 'read' | 'publish' = 'read';
  publicToggle = false;

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
    userComment: new FormControl('', { nonNullable: true }),
  });

  publishForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private themes: ThemesService,
    private nav: NavigationService,
    private studies: StudiesService
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/cuenta']);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/cuenta/temas']);
      return;
    }
    this.load(id);
  }

  get steps(): NonNullable<Theme['steps']> {
    return this.theme?.steps || [];
  }

  get docCount(): number {
    return new Set(this.steps.map((s) => s.documentId)).size;
  }

  get status(): ThemeReviewStatus | string {
    return this.theme?.reviewStatus || 'none';
  }

  get needsChanges(): boolean {
    return this.status === 'changes' || this.status === 'rejected';
  }

  get isApproved(): boolean {
    return this.status === 'approved';
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isOwnerTeacher(): boolean {
    return this.auth.isTeacher || this.auth.isAdmin;
  }

  pillClass(): string {
    switch (this.status) {
      case 'pending':
        return 'pill p-rev';
      case 'approved':
        return 'pill p-ok';
      case 'changes':
      case 'rejected':
        return 'pill p-no';
      default:
        return '';
    }
  }

  pillLabel(): string {
    switch (this.status) {
      case 'pending':
        return 'En revisión';
      case 'approved':
        return 'Aprobado';
      case 'changes':
        return 'Cambios';
      case 'rejected':
        return 'Rechazado';
      default:
        return '';
    }
  }

  kindLabel(): string {
    if (this.isApproved) return 'Tema compartido';
    if (this.theme?.visibility === 'public') return 'Tema público';
    return 'Tema';
  }

  load(id: string): void {
    this.loading = true;
    this.themes.get(id).subscribe({
      next: (t) => {
        this.theme = t;
        this.publicToggle = t.visibility === 'public';
        this.publishForm.patchValue({
          title: t.title,
          description: t.description || '',
        });
        this.loading = false;
        // Open 6B view when there are reviewer notes
        if (this.needsChanges) {
          this.mode = 'read';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  openPublish(): void {
    if (!this.theme) return;
    this.publishForm.patchValue({
      title: this.theme.title,
      description: this.theme.description || '',
    });
    this.publicToggle = true;
    this.mode = 'publish';
    this.error = null;
    this.message = null;
  }

  cancelPublish(): void {
    this.mode = 'read';
  }

  togglePublic(): void {
    this.publicToggle = !this.publicToggle;
  }

  submitForReview(): void {
    if (!this.theme || !this.publishForm.valid) return;
    this.busy = true;
    this.error = null;
    const v = this.publishForm.getRawValue();
    this.themes
      .update(this.theme.id, {
        title: v.title.trim(),
        description: v.description,
      })
      .subscribe({
        next: () => {
          if (!this.publicToggle) {
            this.themes.makePrivate(this.theme!.id).subscribe({
              next: (t) => {
                this.theme = t;
                this.busy = false;
                this.mode = 'read';
                this.message = 'Tema guardado como privado';
              },
              error: (err) => {
                this.busy = false;
                this.error = err?.error?.error || err?.message || 'Error';
              },
            });
            return;
          }
          this.themes.submit(this.theme!.id).subscribe({
            next: (t) => {
              this.theme = t;
              this.busy = false;
              this.mode = 'read';
              this.message = 'Enviado a revisión';
            },
            error: (err) => {
              this.busy = false;
              this.error = err?.error?.error || err?.message || 'Error al enviar';
            },
          });
        },
        error: (err) => {
          this.busy = false;
          this.error = err?.error?.error || err?.message || 'Error al guardar';
        },
      });
  }

  makePrivate(): void {
    if (!this.theme) return;
    this.busy = true;
    this.themes.makePrivate(this.theme.id).subscribe({
      next: (t) => {
        this.theme = t;
        this.busy = false;
        this.message = 'Tema marcado como privado';
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  resubmit(): void {
    this.openPublish();
  }

  download(): void {
    if (!this.theme) return;
    this.themes.download(this.theme.id).subscribe({
      next: (t) => {
        this.theme = t;
        this.message = 'Tema descargado a su biblioteca';
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  addStep(): void {
    if (!this.theme || !this.stepForm.valid) return;
    const v = this.stepForm.getRawValue();
    const steps = [
      ...(this.theme.steps || []).map((s) => ({
        documentId: s.documentId,
        unitIndex: s.unitIndex,
        unitLabel: s.unitLabel ?? undefined,
        userComment: s.userComment ?? undefined,
      })),
      {
        documentId: v.documentId.trim(),
        unitIndex: Number(v.unitIndex),
        unitLabel: v.unitLabel || undefined,
        userComment: v.userComment || undefined,
      },
    ];
    this.themes.setSteps(this.theme.id, steps).subscribe({
      next: (t) => {
        this.theme = t;
        this.message = 'Pasaje añadido';
        this.stepForm.patchValue({ unitLabel: '', userComment: '' });
      },
      error: (err) => {
        this.error =
          err?.error?.error || err?.message || 'Error al guardar pasajes';
      },
    });
  }

  openStep(documentId: string, unitIndex: number, label?: string | null): void {
    this.nav.navigateToUnit(documentId, unitIndex, {
      label: label ?? undefined,
    });
  }

  startPlan(): void {
    const first = this.steps[0];
    if (!first) return;
    this.openStep(first.documentId, first.unitIndex, first.unitLabel);
  }

  coverUrl(): string | null {
    if (!this.theme?.coverImageKey) return null;
    const origin = environment.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
    return `${origin}/uploads/${this.theme.coverImageKey}`;
  }

  onCover(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.theme) return;
    this.uploading = true;
    this.studies.uploadImage(file).subscribe({
      next: (up) => {
        this.themes
          .update(this.theme!.id, { coverImageKey: up.key })
          .subscribe({
            next: (t) => {
              this.theme = t;
              this.uploading = false;
              this.message = `Portada optimizada (${Math.round(up.bytes / 1024)} KB)`;
            },
            error: (err) => {
              this.uploading = false;
              this.error = err?.error?.error || err?.message || 'Error';
            },
          });
      },
      error: (err) => {
        this.uploading = false;
        this.error = err?.error?.error || err?.message || 'Error al subir';
      },
    });
  }

  onRemove(ev: Event, index: number): void {
    ev.stopPropagation();
    this.removeStep(index);
  }

  removeStep(index: number): void {
    if (!this.theme) return;
    const steps = (this.theme.steps || [])
      .filter((_, i) => i !== index)
      .map((s) => ({
        documentId: s.documentId,
        unitIndex: s.unitIndex,
        unitLabel: s.unitLabel ?? undefined,
        userComment: s.userComment ?? undefined,
      }));
    this.themes.setSteps(this.theme.id, steps).subscribe({
      next: (t) => (this.theme = t),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  submittedLabel(): string {
    if (!this.theme?.submittedAt) return '';
    const d = new Date(this.theme.submittedAt);
    if (Number.isNaN(d.getTime())) return '';
    return `Enviado el ${d.toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }
}
