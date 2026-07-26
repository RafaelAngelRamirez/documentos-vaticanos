import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Row in a 2C era list (Padres / Doctores / Santoral lista). */
export interface EraListItem {
  id: string;
  name: string;
  meta: string;
  initials: string;
  /** Optional trailing badge on meta (e.g. “ · en corpus”). */
  badge?: string;
}

export interface EraListGroup {
  era: string;
  items: EraListItem[];
}

/**
 * Listado por eras: `.mrow` móvil + `.cardgrid`/`.bookcard` desktop (handoff 2C).
 */
@Component({
  standalone: true,
  selector: 'app-era-list',
  imports: [CommonModule],
  template: `
    <ng-container *ngFor="let g of groups">
      <div class="era">{{ g.era }}</div>

      <div class="only-mobile">
        <div
          class="mrow"
          *ngFor="let it of g.items"
          role="button"
          tabindex="0"
          (click)="open.emit(it)"
          (keydown.enter)="open.emit(it)"
          style="cursor: pointer"
        >
          <span class="avatar">{{ it.initials }}</span>
          <div class="f1">
            <div class="mname">{{ it.name }}</div>
            <div class="mmeta">
              {{ it.meta }}
              <span *ngIf="it.badge" class="fs12">{{ it.badge }}</span>
            </div>
          </div>
          <span class="chev">›</span>
        </div>
      </div>

      <div class="cardgrid only-desktop">
        <button
          type="button"
          class="bookcard"
          *ngFor="let it of g.items"
          (click)="open.emit(it)"
        >
          <span class="bt">{{ it.name }}</span>
          <span class="bm">{{ it.meta }}{{ it.badge || '' }}</span>
        </button>
      </div>
    </ng-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class EraListComponent {
  @Input() groups: EraListGroup[] = [];
  @Output() open = new EventEmitter<EraListItem>();
}
