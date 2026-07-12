import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Theme, ThemesService } from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { NavigationService } from 'src/app/services/navigation.service';

/** Diseño 6D · Web · Revisar tema (admin) */
@Component({
  standalone: true,
  selector: 'app-admin-revision-detalle',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-revision-detalle.component.html',
  styleUrls: ['./admin-revision-detalle.component.css'],
})
export class AdminRevisionDetalleComponent implements OnInit {
  theme: Theme | null = null;
  loading = false;
  busy = false;
  error: string | null = null;
  message: string | null = null;
  note = '';

  constructor(
    public auth: AuthService,
    private themes: ThemesService,
    private route: ActivatedRoute,
    private router: Router,
    private nav: NavigationService
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/cuenta']);
      return;
    }
    if (!this.auth.isAdmin) {
      this.error = 'Se requiere rol admin';
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/revision']);
      return;
    }
    this.load(id);
  }

  get steps() {
    return this.theme?.steps || [];
  }

  get docCount(): number {
    return new Set(this.steps.map((s) => s.documentId)).size;
  }

  pillClass(): string {
    switch (this.theme?.reviewStatus) {
      case 'pending':
        return 'pill p-rev';
      case 'approved':
        return 'pill p-ok';
      case 'changes':
      case 'rejected':
        return 'pill p-no';
      default:
        return 'pill';
    }
  }

  pillLabel(): string {
    switch (this.theme?.reviewStatus) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'changes':
        return 'Cambios';
      case 'rejected':
        return 'Rechazado';
      default:
        return this.theme?.reviewStatus || '';
    }
  }

  load(id: string): void {
    this.loading = true;
    this.themes.adminGet(id).subscribe({
      next: (t) => {
        this.theme = t;
        this.note = t.reviewNote || '';
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  openStep(documentId: string, unitIndex: number, label?: string | null): void {
    this.nav.navigateToUnit(documentId, unitIndex, {
      label: label ?? undefined,
    });
  }

  decide(decision: 'approved' | 'changes' | 'rejected'): void {
    if (!this.theme) return;
    if ((decision === 'changes' || decision === 'rejected') && !this.note.trim()) {
      this.error = 'Escriba observaciones para el autor';
      return;
    }
    this.busy = true;
    this.error = null;
    this.themes.adminReview(this.theme.id, decision, this.note.trim() || undefined).subscribe({
      next: (t) => {
        this.theme = t;
        this.busy = false;
        this.message =
          decision === 'approved'
            ? 'Tema aprobado y publicado'
            : decision === 'changes'
              ? 'Cambios solicitados al autor'
              : 'Tema rechazado';
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.error || err?.message || 'Error al revisar';
      },
    });
  }

  submittedLabel(): string {
    if (!this.theme?.submittedAt) return '';
    const d = new Date(this.theme.submittedAt);
    if (Number.isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    const when =
      days <= 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`;
    return `Enviado ${when}`;
  }

  initials(): string {
    const n = this.auth.user?.name || 'AD';
    return n
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
