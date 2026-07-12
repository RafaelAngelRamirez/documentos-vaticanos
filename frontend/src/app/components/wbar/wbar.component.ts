import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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

export type WbarMode = 'nav' | 'auth' | 'reader';

/**
 * Shell web ≥1024px (diseño 5A–5H).
 * - nav: navegación principal (5B–5H)
 * - auth: barra mínima de acceso (5A)
 * - reader: chrome de lectura (5D)
 * En móvil no se muestra (bnav / fbar cubren).
 */
@Component({
  standalone: true,
  selector: 'app-wbar',
  imports: [CommonModule, RouterModule],
  template: `
    <!-- 5A · acceso -->
    <header
      *ngIf="mode === 'auth'"
      class="wbar desktop-wbar auth-wbar"
      role="banner"
    >
      <a routerLink="/inicio" class="wmark-link" aria-label="Inicio">
        <span class="wmark">DV</span>
      </a>
      <span class="wname">Documentos Vaticanos</span>
      <span class="wlink auth-cta" style="margin-left: auto">
        ¿Aún no tiene cuenta?
        <a href="javascript:void(0)" (click)="createAccount.emit()">Crear cuenta</a>
      </span>
    </header>

    <!-- 5D · lectura -->
    <header
      *ngIf="mode === 'reader'"
      class="wbar desktop-wbar reader-wbar"
      role="navigation"
      aria-label="Chrome de lectura"
    >
      <a routerLink="/inicio" class="wmark-link" aria-label="Inicio">
        <span class="wmark">DV</span>
      </a>
      <span class="fs13 muted reader-ttl" [attr.title]="readerTitle">{{
        readerTitle || 'Lectura'
      }}</span>
      <button type="button" class="wlink" style="margin-left: auto" (click)="indexClick.emit()">
        Índice
      </button>
      <a routerLink="/notas" class="wlink">Marcadores</a>
      <button
        type="button"
        class="iconb serif"
        style="width: 34px; height: 34px"
        (click)="prefsClick.emit()"
        aria-label="Ajustes de lectura"
      >
        Aa
      </button>
    </header>

    <!-- 5B–5H · nav principal -->
    <header
      *ngIf="mode === 'nav'"
      class="wbar desktop-wbar"
      role="navigation"
      aria-label="Navegación principal"
    >
      <a routerLink="/inicio" class="wmark-link" aria-label="Inicio">
        <span class="wmark">DV</span>
      </a>
      <span class="wname">Documentos Vaticanos</span>
      <a routerLink="/inicio" class="wlink" [class.on]="section === 'inicio'">Inicio</a>
      <a routerLink="/biblioteca" class="wlink" [class.on]="section === 'biblioteca'"
        >Biblioteca</a
      >
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
      <a routerLink="/cuenta" class="dot" [attr.title]="auth.user?.name || 'Cuenta'">{{
        initials
      }}</a>
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
      button.wlink {
        background: none;
        border: none;
        font: inherit;
        padding: 0;
        color: var(--muted);
        cursor: pointer;
      }
      button.wlink:hover {
        color: var(--acc);
      }
      a.dot {
        flex-shrink: 0;
      }
      .wsearch {
        margin-left: auto;
      }
      .auth-cta {
        font-size: 14px;
        color: var(--muted);
      }
      .auth-cta a {
        color: var(--acc);
      }
      .reader-wbar {
        background: var(--bg);
      }
      .reader-ttl {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 48ch;
      }
      button.iconb {
        font-family: 'EB Garamond', serif;
      }
    `,
  ],
})
export class WbarComponent {
  @Input() active: WbarSection = null;
  @Input() mode: WbarMode = 'nav';
  /** 5D: título compacto del documento en lectura. */
  @Input() readerTitle = '';
  @Output() createAccount = new EventEmitter<void>();
  @Output() prefsClick = new EventEmitter<void>();
  @Output() indexClick = new EventEmitter<void>();
  q = '';

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  get section(): WbarSection {
    if (this.active) return this.active;
    const p = (this.router.url || '').split('?')[0];
    if (p.startsWith('/padres')) return 'padres';
    if (p.startsWith('/biblioteca') || p.startsWith('/list') || p.startsWith('/documento')) {
      return 'biblioteca';
    }
    if (
      p.startsWith('/estudio') ||
      p.startsWith('/aprendizaje') ||
      p.startsWith('/notas')
    ) {
      return 'estudio';
    }
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
