import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * CTAs de lectura de portada 2A/5C (§2.4): Comenzar/Continuar, Escuchar, Reiniciar.
 * La página reacciona con openReading / openReading({ autoNarr: true }).
 */
@Component({
  standalone: true,
  selector: 'app-reading-ctas',
  imports: [CommonModule],
  template: `
    <div class="fs13 muted tc pos" *ngIf="positionLabel">
      {{ positionLabel }}
    </div>

    <div [class.ctas-stack]="layout === 'stack'" [class.ctas-inline]="layout === 'inline'">
      <button
        type="button"
        class="primary"
        [class.cta]="layout === 'inline'"
        (click)="start.emit()"
      >
        {{ startLabelResolved }}
      </button>
      <button
        type="button"
        class="gbtn listen"
        [class.listen-block]="layout === 'stack'"
        *ngIf="showListen"
        (click)="listen.emit()"
      >
        ▶ Escuchar con narrador
      </button>
      <ng-content select="[cta-extra]"></ng-content>
      <button
        type="button"
        class="back reinicio"
        *ngIf="showRestart && canContinue && layout === 'stack'"
        (click)="restart.emit()"
      >
        Empezar desde el principio
      </button>
    </div>

    <button
      type="button"
      class="back reinicio"
      *ngIf="showRestart && canContinue && layout === 'inline'"
      (click)="restart.emit()"
    >
      Empezar desde el principio
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .pos {
        margin-top: 14px;
      }
      .ctas-stack .primary {
        display: block;
        width: 100%;
        margin-top: 16px;
      }
      .ctas-stack .listen-block {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-top: 10px;
        min-height: 48px;
        padding: 13px 20px;
      }
      .ctas-stack .reinicio {
        display: block;
        margin: 14px auto 0;
        color: var(--muted);
        background: none;
        border: none;
        font: inherit;
        cursor: pointer;
      }
      .ctas-inline {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 24px;
      }
      .ctas-inline .primary.cta {
        margin: 0;
        width: auto;
        padding: 13px 26px;
        display: inline-block;
      }
      .ctas-inline .listen {
        width: auto;
        padding: 13px 20px;
      }
      .ctas-inline + .reinicio {
        display: block;
        margin: 14px 0 0;
        color: var(--muted);
        background: none;
        border: none;
        font: inherit;
        cursor: pointer;
      }
    `,
  ],
})
export class ReadingCtasComponent {
  @Input() canContinue = false;
  @Input() showRestart = true;
  @Input() showListen = true;
  @Input() positionLabel: string | null | undefined;
  /** Override default “Comenzar/Continuar la lectura”. */
  @Input() startLabel: string | null | undefined;
  /** `stack` = 2A full-width; `inline` = 5C row (fav via cta-extra slot). */
  @Input() layout: 'stack' | 'inline' = 'stack';

  @Output() start = new EventEmitter<void>();
  @Output() listen = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();

  get startLabelResolved(): string {
    if (this.startLabel) return this.startLabel;
    return this.canContinue ? 'Continuar la lectura' : 'Comenzar la lectura';
  }
}
