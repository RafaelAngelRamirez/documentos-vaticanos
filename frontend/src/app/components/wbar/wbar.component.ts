import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/auth/auth.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import { ROUTE } from 'src/app/services/navigation.service';

export type WbarSection =
  | 'inicio'
  | 'biblioteca'
  | 'estudio'
  | 'padres'
  | 'doctores'
  | 'santoral'
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
      <a routerLink="/inicio" class="wmark-link" [attr.aria-label]="t('nav.home')">
        <span class="wmark">DV</span>
      </a>
      <span class="wname">{{ t('app.name') }}</span>
      <span class="wlink auth-cta" style="margin-left: auto">
        {{ t('auth.no_account') }}
        <a href="javascript:void(0)" (click)="createAccount.emit()">{{
          t('auth.create_account')
        }}</a>
      </span>
    </header>

    <!-- 5D · lectura -->
    <header
      *ngIf="mode === 'reader'"
      class="wbar desktop-wbar reader-wbar"
      role="navigation"
      [attr.aria-label]="t('nav.reader_aria')"
    >
      <a routerLink="/inicio" class="wmark-link" [attr.aria-label]="t('nav.home')">
        <span class="wmark">DV</span>
      </a>
      <span class="fs13 muted reader-ttl" [attr.title]="readerTitle">{{
        readerTitle || t('reader.reading')
      }}</span>
      <button type="button" class="wlink" style="margin-left: auto" (click)="indexClick.emit()">
        {{ t('reader.index') }}
      </button>
      <a routerLink="/notas" class="wlink">{{ t('reader.markers') }}</a>
      <button
        type="button"
        class="iconb serif"
        style="width: 34px; height: 34px"
        (click)="prefsClick.emit()"
        [attr.aria-label]="t('reader.prefs_aria')"
      >
        Aa
      </button>
    </header>

    <!-- 5B–5H · nav principal -->
    <header
      *ngIf="mode === 'nav'"
      class="wbar desktop-wbar"
      role="navigation"
      [attr.aria-label]="t('nav.main_aria')"
    >
      <a routerLink="/inicio" class="wmark-link" [attr.aria-label]="t('nav.home')">
        <span class="wmark">DV</span>
      </a>
      <span class="wname">{{ t('app.name') }}</span>
      <a routerLink="/inicio" class="wlink" [class.on]="section === 'inicio'">{{
        t('nav.home')
      }}</a>
      <a routerLink="/biblioteca" class="wlink" [class.on]="section === 'biblioteca'">{{
        t('nav.library')
      }}</a>
      <a routerLink="/estudio" class="wlink" [class.on]="section === 'estudio'">{{
        t('nav.study')
      }}</a>
      <a routerLink="/padres" class="wlink" [class.on]="section === 'padres'">{{
        t('nav.parents')
      }}</a>
      <a routerLink="/doctores" class="wlink" [class.on]="section === 'doctores'">{{
        t('nav.doctors')
      }}</a>
      <a routerLink="/santoral" class="wlink" [class.on]="section === 'santoral'">{{
        t('nav.saints')
      }}</a>
      <a routerLink="/cuenta/temas" class="wlink" [class.on]="section === 'temas'">{{
        t('nav.themes')
      }}</a>
      <input
        class="wsearch"
        type="search"
        [attr.placeholder]="t('nav.search_placeholder')"
        [value]="q"
        (keydown.enter)="search($event)"
        [attr.aria-label]="t('nav.search')"
      />
      <a routerLink="/cuenta" class="dot" [attr.title]="auth.user?.name || t('nav.account')">{{
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
export class WbarComponent implements OnDestroy {
  @Input() active: WbarSection = null;
  @Input() mode: WbarMode = 'nav';
  /** 5D: título compacto del documento en lectura. */
  @Input() readerTitle = '';
  @Output() createAccount = new EventEmitter<void>();
  @Output() prefsClick = new EventEmitter<void>();
  @Output() indexClick = new EventEmitter<void>();
  q = '';
  /** Tick so labels re-resolve when locale changes. */
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    public auth: AuthService,
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

  get section(): WbarSection {
    if (this.active) return this.active;
    const p = (this.router.url || '').split('?')[0];
    if (p.startsWith('/padres')) return 'padres';
    if (p.startsWith('/doctores')) return 'doctores';
    if (p.startsWith('/santoral')) return 'santoral';
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
