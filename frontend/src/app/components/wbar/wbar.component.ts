import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ROUTE } from 'src/app/services/navigation.service';

export type WbarSection =
  | 'inicio'
  | 'biblioteca'
  | 'estudio'
  | 'padres'
  | 'temas'
  | null;

/**
 * Shell web ≥1024px (diseño 5A–5H): wbar con enlaces principales.
 * En móvil no se muestra (bnav cubre la navegación).
 */
@Component({
  standalone: true,
  selector: 'app-wbar',
  imports: [CommonModule, RouterModule],
  template: `
    <header class="wbar desktop-wbar" *ngIf="visible" role="navigation" aria-label="Navegación principal">
      <a routerLink="/inicio" class="wmark-link" aria-label="Inicio">
        <span class="wmark">DV</span>
      </a>
      <span class="wname">Documentos Vaticanos</span>
      <a routerLink="/inicio" class="wlink" [class.on]="section === 'inicio'">Inicio</a>
      <a routerLink="/biblioteca" class="wlink" [class.on]="section === 'biblioteca'">Biblioteca</a>
      <a routerLink="/estudio" class="wlink" [class.on]="section === 'estudio'">Estudio</a>
      <a routerLink="/padres" class="wlink" [class.on]="section === 'padres'">Padres</a>
      <a routerLink="/cuenta/temas" class="wlink" [class.on]="section === 'temas'">Temas</a>
      <input
        class="wsearch"
        type="search"
        placeholder="Buscar…"
        [value]="q"
        (keydown.enter)="search($event)"
        aria-label="Buscar"
      />
      <a
        routerLink="/cuenta"
        class="dot"
        [attr.title]="auth.user?.name || 'Cuenta'"
        >{{ initials }}</a
      >
    </header>
  `,
  styles: [
    `
      .desktop-wbar {
        display: none;
      }
      @media (min-width: 1024px) {
        .desktop-wbar {
          display: flex;
        }
      }
      a.wlink,
      a.wmark-link,
      a.dot {
        text-decoration: none;
        color: inherit;
      }
      a.dot {
        flex-shrink: 0;
      }
      .wsearch {
        margin-left: auto;
      }
    `,
  ],
})
export class WbarComponent {
  @Input() active: WbarSection = null;
  q = '';

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  get visible(): boolean {
    // Always in DOM; CSS hides under 1024px
    return true;
  }

  get section(): WbarSection {
    if (this.active) return this.active;
    const p = (this.router.url || '').split('?')[0];
    if (p.startsWith('/padres')) return 'padres';
    if (p.startsWith('/biblioteca') || p.startsWith('/list')) return 'biblioteca';
    if (p.startsWith('/estudio') || p.startsWith('/aprendizaje')) return 'estudio';
    if (p.startsWith('/cuenta/temas') || p.startsWith('/explorar')) return 'temas';
    if (p === '/' || p.startsWith('/inicio') || p.startsWith(`/${ROUTE.inicio}`)) {
      return 'inicio';
    }
    return null;
  }

  get initials(): string {
    const n = this.auth.user?.name || 'DV';
    return n
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  search(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const q = (input?.value || '').trim();
    if (!q) {
      this.router.navigate(['/buscar']);
      return;
    }
    this.router.navigate(['/buscar'], { queryParams: { q } });
  }
}
