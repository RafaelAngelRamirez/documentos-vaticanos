import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/auth/auth.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';

/** Design product top bar: title + avatar (1C/1D/1E fbar). */
@Component({
  standalone: true,
  selector: 'app-fbar',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="fbar hair">
      <a
        *ngIf="back"
        class="fs14 back"
        [routerLink]="backLink"
        [queryParams]="backQueryParams || {}"
      >{{ back }}</a>
      <span class="ftitle" [class.mid]="!!back">{{ resolvedTitle }}</span>
      <button
        *ngIf="avatar"
        type="button"
        class="dot"
        [attr.title]="auth.user?.name || i18n.t('nav.account')"
        (click)="goAccount()"
      >
        {{ initials }}
      </button>
      <!-- 3H.html:5-7 / 4D.html:7 · hueco de equilibrio cuando no hay avatar -->
      <span *ngIf="!avatar" class="sp34" aria-hidden="true"></span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
      }
      .hair {
        border-bottom: 1px solid var(--line);
      }
      .fbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 22px;
        max-width: 640px;
        margin: 0 auto;
      }
      .dot {
        cursor: pointer;
        border: 1px solid var(--btnb);
        background: var(--btn);
      }
      .back {
        cursor: pointer;
        color: var(--ink);
        text-decoration: none;
      }
      .back:hover {
        color: var(--acc);
      }
      .ftitle.mid {
        font-size: 16px;
      }
      .sp34 {
        width: 34px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class AppFbarComponent implements OnDestroy {
  /**
   * Título del fbar. Si se omite, usa `nav.study` (Estudio) del catálogo i18n.
   * Las pantallas pueden pasar un string ya traducido o una clave fija ES.
   */
  @Input() title: string | null = null;
  /** Enlace de retorno a la izquierda (p. ej. "← Cuenta"). */
  @Input() back: string | null = null;
  @Input() backLink: string | string[] = '/';
  /** Optional query params for back routerLink (e.g. santoral calendar). */
  @Input() backQueryParams: Record<string, string> | null = null;
  /** false → hueco de 34px a la derecha (3H sin avatar). */
  @Input() avatar = true;

  /** Tick so default title re-resolves when locale changes. */
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

  get resolvedTitle(): string {
    void this.localeTick;
    if (this.title != null && this.title !== '') {
      return this.title;
    }
    return this.i18n.t('nav.study');
  }

  get initials(): string {
    const n = this.auth.user?.name?.trim();
    if (!n) return '·';
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('');
  }

  goAccount(): void {
    this.router.navigate(['/cuenta']);
  }
}
