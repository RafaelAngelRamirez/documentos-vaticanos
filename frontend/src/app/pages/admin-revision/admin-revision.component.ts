import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Theme, ThemesService } from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';

type AdminFilter = 'pending' | 'changes' | 'approved' | 'rejected';

/** Diseño 6C · Web · Cola de revisión (admin) */
@Component({
  standalone: true,
  selector: 'app-admin-revision',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-revision.component.html',
  styleUrls: ['./admin-revision.component.css'],
})
export class AdminRevisionComponent implements OnInit {
  items: Theme[] = [];
  counts: Record<string, number> = {};
  filter: AdminFilter = 'pending';
  loading = false;
  error: string | null = null;
  q = '';

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
    if (!this.auth.isAdmin) {
      this.error = 'Se requiere rol admin';
      return;
    }
    this.reload();
  }

  setFilter(f: AdminFilter): void {
    this.filter = f;
    this.reload();
  }

  get filtered(): Theme[] {
    const term = this.q.trim().toLowerCase();
    if (!term) return this.items;
    return this.items.filter((t) => {
      const hay = `${t.title} ${t.owner?.name || ''} ${t.owner?.email || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }

  countOf(key: string): number {
    return this.counts[key] ?? 0;
  }

  pillClass(t: Theme): string {
    switch (t.reviewStatus) {
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

  pillLabel(t: Theme): string {
    switch (t.reviewStatus) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'changes':
        return 'Cambios';
      case 'rejected':
        return 'Rechazado';
      default:
        return t.reviewStatus || '';
    }
  }

  meta(t: Theme): string {
    const author = t.owner?.name || 'Autor';
    const n = t.steps?.length ?? 0;
    const docs = new Set((t.steps || []).map((s) => s.documentId)).size;
    if (t.reviewStatus === 'changes') {
      return `${author} · devuelto con observaciones`;
    }
    return `${author} · ${n} págs · ${docs} documento${docs === 1 ? '' : 's'}`;
  }

  when(t: Theme): string {
    const iso = t.submittedAt || t.updatedAt;
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    if (days < 30) return `hace ${days} días`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  open(t: Theme): void {
    this.router.navigate(['/admin/revision', t.id]);
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.themes.adminList(this.filter).subscribe({
      next: (res) => {
        this.items = res.items;
        this.counts = res.counts || {};
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.error || err?.message || 'No se pudo cargar la cola';
      },
    });
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
