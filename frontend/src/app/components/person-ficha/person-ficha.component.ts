import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  WbarComponent,
  WbarSection,
} from 'src/app/components/wbar/wbar.component';
import { CoverHeaderComponent } from 'src/app/components/reading-cover';

/** Work row on a 2D person ficha (Padre / Doctor / Santo). */
export interface PersonWorkLink {
  title: string;
  documentId?: string;
  sourceUrl?: string;
}

/**
 * Ficha de persona (handoff 2D): back + cover + quote + obras + temas.
 * Bloques opcionales vía ng-content: [ficha-after-quote], [ficha-before-works],
 * [ficha-after-works], [ficha-extra].
 */
@Component({
  standalone: true,
  selector: 'app-person-ficha',
  imports: [CommonModule, RouterModule, WbarComponent, CoverHeaderComponent],
  template: `
    <div class="app web-shell">
      <app-wbar [active]="wbarActive"></app-wbar>

      <div class="fbar hair">
        <a class="fs14 back" [routerLink]="backLink">{{ backLabel }}</a>
        <ng-content select="[ficha-fbar-end]"></ng-content>
      </div>

      <app-cover-header
        [kindLine]="kindLine"
        [title]="title"
        [subtitle]="subtitle"
      ></app-cover-header>

      <div class="fbody">
        <div class="quote" *ngIf="quote">«{{ quote }}»</div>
        <div class="fs12 muted" style="margin-top: 8px" *ngIf="quoteSource">
          {{ quoteSource }}
        </div>

        <ng-content select="[ficha-after-quote]"></ng-content>

        <ng-content select="[ficha-before-works]"></ng-content>

        <div class="sect" *ngIf="showWorksSection">
          {{ worksHeading }}
        </div>
        <ng-container *ngFor="let w of works; let i = index">
          <a
            *ngIf="w.documentId as docId"
            class="toc obra-link"
            [routerLink]="['/documento', docId]"
          >
            <span class="tnum">{{ i + 1 }}</span>
            <span>{{ w.title }}</span>
          </a>
          <div *ngIf="!w.documentId" class="toc obra-pending">
            <span class="tnum">{{ i + 1 }}</span>
            <span>{{ w.title }}</span>
            <span class="fs12 muted"> · {{ pendingLabel }}</span>
            <a
              *ngIf="w.sourceUrl"
              class="app-lang-link fs12"
              [href]="w.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              (click)="$event.stopPropagation()"
            >
              · fuente
            </a>
          </div>
        </ng-container>
        <div
          class="fs13 muted"
          *ngIf="showWorksSection && !works.length"
          style="margin-top: 8px"
        >
          {{ worksEmptyLabel }}
        </div>

        <ng-content select="[ficha-after-works]"></ng-content>

        <div class="sect" *ngIf="themes?.length">Temas</div>
        <div class="chips" *ngIf="themes?.length">
          <button
            type="button"
            class="chip theme-chip"
            *ngFor="let t of themes"
            [class.static]="!themesClickable"
            (click)="onTheme(t)"
          >
            {{ t }}
          </button>
        </div>

        <ng-content select="[ficha-extra]"></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./person-ficha.component.css'],
})
export class PersonFichaComponent {
  @Input() wbarActive: WbarSection = null;
  @Input() backLink: string | any[] = '/';
  @Input() backLabel = '←';
  @Input() kindLine = '';
  @Input() title = '';
  @Input() subtitle: string | null | undefined;
  @Input() quote: string | null | undefined;
  @Input() quoteSource: string | null | undefined;
  @Input() works: PersonWorkLink[] = [];
  @Input() worksHeading = 'Obras en la biblioteca';
  @Input() worksEmptyLabel = 'Obras próximamente en el corpus.';
  @Input() pendingLabel = 'próximamente';
  /** When false, hide works heading even if empty (caller uses own section). */
  @Input() showWorksSection = true;
  @Input() themes: string[] | null | undefined;
  /** When true, themes emit themeClick (santo → buscar). */
  @Input() themesClickable = false;
  @Output() themeClick = new EventEmitter<string>();

  onTheme(t: string): void {
    if (!this.themesClickable) return;
    this.themeClick.emit(t);
  }
}
