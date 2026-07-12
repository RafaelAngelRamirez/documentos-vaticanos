import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

/**
 * Bottom sheet del diseño (3E nota, 3F cita, 4B descargas…):
 * backdrop + .sheet con asa (.grab). El aspecto visual viene de las
 * clases globales del handoff; aquí solo el posicionamiento overlay.
 */
@Component({
  standalone: true,
  selector: 'dv-sheet',
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <div class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="label">
      <div class="grab"></div>
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }
      .sheet-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
      }
      .sheet {
        position: relative;
        width: 100%;
        max-width: 520px;
        margin: 0 auto;
        box-sizing: border-box;
        padding-bottom: calc(26px + env(safe-area-inset-bottom));
        animation: dv-sheet-up 0.18s ease-out;
      }
      @keyframes dv-sheet-up {
        from {
          transform: translateY(24px);
          opacity: 0.6;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class DvSheetComponent {
  @Input() label = 'Panel';

  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
