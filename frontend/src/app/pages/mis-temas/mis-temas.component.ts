import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Theme,
  ThemeReviewStatus,
  ThemesService,
} from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';

/** Diseño 6A · Mis temas · estados p-ok / p-rev / p-no */
@Component({
  standalone: true,
  selector: 'app-mis-temas',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AppFbarComponent],
  templateUrl: './mis-temas.component.html',
  styleUrls: ['./mis-temas.component.css'],
})
export class MisTemasComponent implements OnInit {
  items: Theme[] = [];
  loading = false;
  error: string | null = null;
  showCreate = false;

  form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  constructor(
    public auth: AuthService,
    private themes: ThemesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/cuenta']);
      return;
    }
    this.reload();
  }

  get publicThemes(): Theme[] {
    return this.items.filter(
      (t) => t.visibility === 'public' || this.statusOf(t) !== 'none'
    );
  }

  get privateThemes(): Theme[] {
    return this.items.filter(
      (t) => t.visibility !== 'public' && this.statusOf(t) === 'none'
    );
  }

  statusOf(t: Theme): ThemeReviewStatus | string {
    return t.reviewStatus || 'none';
  }

  pillClass(t: Theme): string {
    switch (this.statusOf(t)) {
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

  pillLabel(t: Theme): string {
    switch (this.statusOf(t)) {
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

  metaLine(t: Theme): string {
    const st = this.statusOf(t);
    if (st === 'pending' && t.submittedAt) {
      return `Enviado ${this.relative(t.submittedAt)}`;
    }
    if (st === 'approved') {
      const n = t.downloads ?? 0;
      return `Publicado · ${n} descarga${n === 1 ? '' : 's'}`;
    }
    if (st === 'changes' || st === 'rejected') {
      return t.reviewNote
        ? t.reviewNote.slice(0, 80) + (t.reviewNote.length > 80 ? '…' : '')
        : 'Observaciones del revisor';
    }
    const n = t.steps?.length ?? 0;
    return n
      ? `${n} pasaje${n === 1 ? '' : 's'} · solo usted`
      : 'Solo en este dispositivo';
  }

  relative(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    if (days < 30) return `hace ${days} días`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  reload(): void {
    this.loading = true;
    this.themes.list().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  create(): void {
    if (!this.form.valid) return;
    const { title, description } = this.form.getRawValue();
    this.themes
      .create({ title, description: description || undefined })
      .subscribe({
        next: (t) => {
          this.form.reset({ title: '', description: '' });
          this.showCreate = false;
          this.router.navigate(['/cuenta/temas', t.id]);
        },
        error: (err) => {
          this.error = err?.error?.error || err?.message || 'No se pudo crear';
        },
      });
  }

  open(t: Theme): void {
    this.router.navigate(['/cuenta/temas', t.id]);
  }

  remove(t: Theme, ev: Event): void {
    ev.stopPropagation();
    if (!confirm(`¿Borrar el tema «${t.title}»?`)) return;
    this.themes.remove(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo borrar';
      },
    });
  }
}
