import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';
import { t } from 'src/app/core/i18n/ui-strings';

export type BnavSection = 'inicio' | 'biblioteca' | 'about' | null;

@Component({
  standalone: true,
  selector: 'app-bnav',
  imports: [CommonModule],
  template: `
    <nav class="bnav" [attr.aria-label]="t('nav.bottom_aria')">
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'inicio'"
        (click)="nav.go_to_search()"
      >
        <span class="bico">⌂</span>{{ t('nav.home') }}
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'biblioteca'"
        (click)="nav.go_to_documents()"
      >
        <span class="bico">▤</span>{{ t('nav.library') }}
      </button>
      <button
        type="button"
        class="bitem"
        [class.on]="section === 'about'"
        (click)="nav.go_to_about()"
      >
        <span class="bico">☰</span>{{ t('nav.about') }}
      </button>
    </nav>
  `,
})
export class BnavComponent {
  @Input() section: BnavSection = null;
  t = t;
  route = ROUTE;
  constructor(public nav: NavigationService) {}
}
