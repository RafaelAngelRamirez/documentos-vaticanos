import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTE } from 'src/app/services/navigation.service';

export type BnavSection =
  | 'inicio'
  | 'biblioteca'
  | 'estudio'
  | 'ajustes'
  | null;

/**
 * Barra de navegación inferior del diseño (móvil):
 * Inicio · Biblioteca · Estudio · Ajustes.
 * Oculta en ≥1024px (ver adaptaciones en styles.css).
 */
@Component({
  standalone: true,
  selector: 'app-bnav',
  imports: [CommonModule],
  template: `
    <nav class="bnav" aria-label="Navegación inferior">
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'inicio'"
        (click)="go(['/', route.inicio])"
      >
        <span class="bico">⌂</span>Inicio
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'biblioteca'"
        (click)="go(['/biblioteca'])"
      >
        <span class="bico">▤</span>Biblioteca
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'estudio'"
        (click)="go(['/estudios'])"
      >
        <span class="bico">✎</span>Estudio
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'ajustes'"
        (click)="go(['/ajustes'])"
      >
        <span class="bico">☰</span>Ajustes
      </button>
    </nav>
  `,
  styles: [
    `
      button.bitem {
        background: none;
        border: none;
        font-family: inherit;
      }
    `,
  ],
})
export class BnavComponent {
  /** Forzar sección activa; si se omite, se deriva de la URL actual. */
  @Input() current: BnavSection = null;

  route = ROUTE;

  constructor(private router: Router) {}

  get section(): BnavSection {
    if (this.current) return this.current;
    const p = (this.router.url || '').split('?')[0].split('#')[0];
    if (p.startsWith('/ajustes')) return 'ajustes';
    if (
      p.startsWith('/estudio') ||
      p.startsWith('/aprendizaje') ||
      p.startsWith('/explorar')
    ) {
      return 'estudio';
    }
    if (
      p.startsWith('/biblioteca') ||
      p.includes('documentos/listar') ||
      p.startsWith('/buscar')
    ) {
      return 'biblioteca';
    }
    if (p === '/' || p === '' || p.startsWith(`/${ROUTE.inicio}`)) {
      return 'inicio';
    }
    return null;
  }

  go(commands: unknown[]): void {
    this.router.navigate(commands as never[]);
  }
}
