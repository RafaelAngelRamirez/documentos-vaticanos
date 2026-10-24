import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';

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

    <div
      [class.ctas-stack]="layout === 'stack'"
      [class.ctas-inline]="layout === 'inline'"
      [attr.data-tick]="localeTick"
    >
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
        ▶ {{ t('reader.listen') }}
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
export class ReadingCtasComponent implements OnDestroy {
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

  localeTick = 0;
  private sub = new Subscription();

  constructor(public i18n: UiI18nService) {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  get startLabelResolved(): string {
    if (this.startLabel) return this.startLabel;
    return this.canContinue ? this.t('common.continue') : this.t('reader.start');
  }
}
