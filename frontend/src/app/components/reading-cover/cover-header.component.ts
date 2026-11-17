import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Portada tipográfica del handoff 2A/2D (`.dkind` · `.dtitle` · `.dsub`).
 * `variant="web"` usa tipografía 5C sin envolver en `.dcover`.
 */
@Component({
  standalone: true,
  selector: 'app-cover-header',
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="variant === 'cover'; else webTpl">
      <div class="dcover">
        <div class="dkind" *ngIf="kindLine">{{ kindLine }}</div>
        <div class="dtitle">{{ title }}</div>
        <div class="dsub" *ngIf="subtitle">{{ subtitle }}</div>
      </div>
    </ng-container>
    <ng-template #webTpl>
      <div class="dkind" *ngIf="kindLine">{{ kindLine }}</div>
      <div class="serif fw6 web-title">{{ title }}</div>
      <div class="dsub web-sub" *ngIf="subtitle">{{ subtitle }}</div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .web-title {
        font-size: 40px;
        line-height: 1.1;
        margin: 12px 0 8px;
      }
      .web-sub {
        font-size: 19px;
      }
      /* En la columna de la portada (<1024) el título usa el cuerpo de 2A. */
      @media (max-width: 1023px) {
        :host(.in-measure) .web-title {
          font-size: 30px;
          line-height: 1.15;
        }
        :host(.in-measure) .web-sub {
          font-size: 16px;
        }
      }
    `,
  ],
})
export class CoverHeaderComponent {
  @Input() kindLine = '';
  @Input() title = '';
  @Input() subtitle: string | null | undefined;
  /** `cover` = 2A `.dcover`; `web` = 5C title block without paper cover. */
  @Input() variant: 'cover' | 'web' = 'cover';
}
