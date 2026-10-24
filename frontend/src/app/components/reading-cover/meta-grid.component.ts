import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface MetaGridCell {
  key: string;
  value: string;
}

/** Grid de metadatos handoff 2A (`.meta2` / `.mcell`). */
@Component({
  standalone: true,
  selector: 'app-meta-grid',
  imports: [CommonModule],
  template: `
    <div class="meta2" *ngIf="cells?.length" [style.max-width]="maxWidth || null">
      <div class="mcell" *ngFor="let c of cells">
        <div class="mk">{{ c.key }}</div>
        <div class="mv">{{ c.value }}</div>
      </div>
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
export class MetaGridComponent {
  @Input() cells: MetaGridCell[] = [];
  /** e.g. `480px` on 5C desktop. */
  @Input() maxWidth: string | null = null;
}
