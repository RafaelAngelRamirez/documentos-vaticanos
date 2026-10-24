import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TocEntry } from 'src/app/services/document-toc.logic';

/**
 * Índice de navegación (handoff 2A `.toc`).
 * Emite la entrada al seleccionar; la página llama a openReading.
 */
@Component({
  standalone: true,
  selector: 'app-doc-toc',
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="hasRows">
      <div
        class="sect"
        *ngIf="showHeading"
        [style.margin-top]="headingMarginTop || null"
      >
        {{ heading }}
      </div>
      <div
        class="toc"
        *ngFor="let c of entries"
        role="button"
        tabindex="0"
        (click)="onSelect(c)"
        (keydown.enter)="onSelect(c)"
        (keydown.space)="$event.preventDefault(); onSelect(c)"
      >
        <span class="tnum">{{ c.num }}</span>
        <span>{{ c.title }}</span>
      </div>
    </ng-container>
    <div
      class="fs13 muted"
      *ngIf="emptyHint && !hasRows"
      style="margin-top: 8px"
    >
      {{ emptyHint }}
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DocTocComponent {
  @Input() entries: TocEntry[] = [];
  @Input() heading = 'Índice';
  /** When false, never show the `.sect` heading (parent may supply its own). */
  @Input() showHeading = true;
  /**
   * Minimum entries required to render the list (santo bio uses 2 to hide
   * a single “whole bio” row as a fake index).
   */
  @Input() minEntries = 1;
  @Input() emptyHint: string | null = null;
  @Input() headingMarginTop: string | null = null;
  @Output() select = new EventEmitter<TocEntry>();

  get hasRows(): boolean {
    return (this.entries?.length ?? 0) >= this.minEntries;
  }

  onSelect(entry: TocEntry): void {
    if (!entry || typeof entry.unitIndex !== 'number') return;
    this.select.emit(entry);
  }
}
