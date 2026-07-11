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
      <span class="ftitle">{{ title }}</span>
      <button
        type="button"
        class="dot"
        [attr.title]="auth.user?.name || 'Cuenta'"
        (click)="goAccount()"
      >
        {{ initials }}
      </button>
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
    `,
  ],
})
export class AppFbarComponent {
  @Input() title = 'Estudio';

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
