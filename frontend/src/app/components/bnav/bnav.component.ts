import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
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
    <nav class="bnav" [attr.aria-label]="i18n.t('nav.bottom_aria')">
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'inicio'"
        (click)="go(['/', route.inicio])"
      >
        <span class="bico">⌂</span>{{ t('nav.home') }}
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'biblioteca'"
        (click)="go(['/biblioteca'])"
      >
        <span class="bico">▤</span>{{ t('nav.library') }}
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'estudio'"
        (click)="go(['/estudios'])"
      >
        <span class="bico">✎</span>{{ t('nav.study') }}
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'ajustes'"
        (click)="go(['/ajustes'])"
      >
        <span class="bico">☰</span>{{ t('nav.settings') }}
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
export class BnavComponent implements OnDestroy {
  /** Forzar sección activa; si se omite, se deriva de la URL actual. */
  @Input() current: BnavSection = null;

  route = ROUTE;
  /** Tick so labels re-resolve when locale changes. */
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    private router: Router,
    public i18n: UiI18nService,
  ) {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string): string {
    void this.localeTick;
    return this.i18n.t(key);
  }

  get section(): BnavSection {
    if (this.current) return this.current;
    const p = (this.router.url || '').split('?')[0].split('#')[0];
    if (p.startsWith('/ajustes')) return 'ajustes';
    if (p.startsWith('/estudio') || p.startsWith('/aprendizaje')) {
      return 'estudio';
    }
    if (
      p.startsWith('/biblioteca') ||
      p.includes('documentos/listar') ||
      p.startsWith('/buscar') ||
      p.startsWith('/padres') ||
      p.startsWith('/doctores') ||
      p.startsWith('/santoral') ||
      p.startsWith('/explorar') ||
      p.startsWith('/cuenta/temas')
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
