import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import {
  Anotacion,
  AnotacionesService,
} from 'src/app/services/anotaciones.service';
import {
  PersonalReference,
  ReferencesService,
} from 'src/app/core/account/references.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ROUTE } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';

type Tab = 'subrayados' | 'marcadores' | 'notas';

/** Diseño 3G · Notas y marcadores. */
@Component({
  standalone: true,
  selector: 'app-notas',
  imports: [CommonModule, AppFbarComponent],
  templateUrl: './notas.component.html',
  styleUrls: ['./notas.component.css'],
})
export class NotasComponent implements OnInit {
  tab: Tab = 'subrayados';
  refs: PersonalReference[] = [];
  refsLoading = false;
  refsError: string | null = null;
  apiEnabled = Boolean(environment.apiBaseUrl);

  constructor(
    public auth: AuthService,
    private anotaciones: AnotacionesService,
    private references: ReferencesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRefs();
  }

  get subrayados(): Anotacion[] {
    return this.anotaciones.snapshot.filter((a) => a.kind === 'subrayado');
  }

  get notas(): Anotacion[] {
    return this.anotaciones.snapshot.filter((a) => a.kind === 'nota');
  }

  get hasAny(): boolean {
    return (
      this.subrayados.length > 0 || this.notas.length > 0 || this.refs.length > 0
    );
  }

  setTab(t: Tab): void {
    this.tab = t;
  }

  private loadRefs(): void {
    if (!this.apiEnabled || !this.auth.isLoggedIn) return;
    this.refsLoading = true;
    this.references.list().subscribe({
      next: (items) => {
        this.refs = items;
        this.refsLoading = false;
      },
      error: (err) => {
        this.refsLoading = false;
        this.refsError =
          err?.error?.error || err?.message || 'Error al cargar marcadores';
      },
    });
  }

  /** «hoy · ayer · hace N días…» para .nsrc. */
  when(ts: number | string): string {
    const t = typeof ts === 'string' ? Date.parse(ts) : ts;
    if (!Number.isFinite(t)) return '';
    const days = Math.floor((Date.now() - t) / 86_400_000);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 7) return `hace ${days} días`;
    if (days < 30) {
      const w = Math.floor(days / 7);
      return w === 1 ? 'hace 1 semana' : `hace ${w} semanas`;
    }
    return new Date(t).toLocaleDateString();
  }

  src(
    x: { unitLabel?: string | null; documentId: string; unitIndex: number },
    ts: number | string
  ): string {
    return `${x.unitLabel || x.documentId} · Nº ${x.unitIndex} · ${this.when(ts)}`;
  }

  open(x: { documentId: string; unitIndex: number }): void {
    this.router.navigate([ROUTE.leyendo, x.documentId, ROUTE.punto, x.unitIndex]);
  }

  removeAnotacion(ev: Event, id: string): void {
    ev.stopPropagation();
    this.anotaciones.remove(id);
  }

  removeRef(ev: Event, id: string): void {
    ev.stopPropagation();
    this.references.remove(id).subscribe({
      next: () => (this.refs = this.refs.filter((r) => r.id !== id)),
      error: (err) => {
        this.refsError = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }

  /** Exporta el contenido propio como texto plano (archivo local). */
  exportAll(): void {
    const lines: string[] = [];
    for (const a of this.anotaciones.snapshot) {
      lines.push(
        `«${a.excerpt}»${a.nota ? `\n  ${a.nota}` : ''}\n  — ${
          a.unitLabel || a.documentId
        } · Nº ${a.unitIndex}`
      );
    }
    for (const r of this.refs) {
      lines.push(
        `★ ${r.unitLabel || r.documentId} · Nº ${r.unitIndex}${
          r.note ? ` — ${r.note}` : ''
        }`
      );
    }
    const blob = new Blob([lines.join('\n\n') + '\n'], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mis-notas.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}
