import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Theme, ThemesService } from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-tema-detalle',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './tema-detalle.component.html',
  styleUrls: ['./tema-detalle.component.css'],
})
export class TemaDetalleComponent implements OnInit {
  theme: Theme | null = null;
  loading = false;
  error: string | null = null;
  message: string | null = null;

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private themes: ThemesService,
    private nav: NavigationService
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

  load(id: string): void {
    this.loading = true;
    this.themes.get(id).subscribe({
      next: (t) => {
        this.theme = t;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
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
        this.message = 'Paso añadido';
        this.stepForm.patchValue({ unitLabel: '', userComment: '' });
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Error al guardar pasos';
      },
    });
  }

  openStep(documentId: string, unitIndex: number, label?: string | null): void {
    this.nav.navigateToUnit(documentId, unitIndex, {
      label: label ?? undefined,
    });
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
}
