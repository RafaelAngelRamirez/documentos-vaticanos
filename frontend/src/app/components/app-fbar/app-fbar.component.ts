import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';

/** Design product top bar: title + avatar (1C/1D/1E fbar). */
@Component({
  standalone: true,
  selector: 'app-fbar',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="fbar hair">
      <a *ngIf="back" class="fs14 back" [routerLink]="backLink">{{ back }}</a>
      <span class="ftitle" [class.mid]="!!back">{{ title }}</span>
      <button
        *ngIf="avatar"
        type="button"
        class="dot"
        [attr.title]="auth.user?.name || 'Cuenta'"
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
export class AppFbarComponent {
  @Input() title = 'Estudio';
  /** Enlace de retorno a la izquierda (p. ej. "← Cuenta"). */
  @Input() back: string | null = null;
  @Input() backLink: string | string[] = '/';
  /** false → hueco de 34px a la derecha (3H sin avatar). */
  @Input() avatar = true;

  constructor(public auth: AuthService, private router: Router) {}

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
