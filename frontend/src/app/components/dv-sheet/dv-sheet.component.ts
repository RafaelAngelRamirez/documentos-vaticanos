import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { BackService } from 'src/app/services/back.service';

/** F5: umbral de descarte por distancia (px) y por velocidad (px/ms). */
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

/**
 * Bottom sheet del diseño (3E nota, 3F cita, 4B descargas…):
 * backdrop + .sheet con asa (.grab). El aspecto visual viene de las
 * clases globales del handoff; aquí solo el posicionamiento overlay.
 * F5: drag-to-dismiss arrastrando desde el asa.
 */
@Component({
  standalone: true,
  selector: 'dv-sheet',
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label"
      [class.dragging]="dragging"
      [class.settling]="settling"
      [style.transform]="dragY > 0 ? 'translateY(' + dragY + 'px)' : ''"
    >
      <div
        class="grab"
        (pointerdown)="onGrabDown($event)"
        (pointermove)="onGrabMove($event)"
        (pointerup)="onGrabUp($event)"
        (pointercancel)="onGrabUp($event)"
      ></div>
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
        padding-bottom: calc(26px + var(--safe-area-inset-bottom));
        animation: dv-sheet-up 0.18s ease-out;
      }
      .sheet.dragging {
        animation: none;
        transition: none;
      }
      .sheet.settling {
        transition: transform 0.18s ease-out;
      }
      .grab {
        touch-action: none;
        cursor: grab;
      }
      .sheet.dragging .grab {
        cursor: grabbing;
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
      @media (prefers-reduced-motion: reduce) {
        .sheet {
          animation: none;
        }
        .sheet.settling {
          transition: none;
        }
      }
    `,
  ],
})
export class DvSheetComponent implements OnInit, OnDestroy {
  @Input() label = 'Panel';

  @Output() closed = new EventEmitter<void>();

  /** F5: estado del drag-to-dismiss. */
  dragging = false;
  settling = false;
  dragY = 0;

  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartTime = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  private unregisterBack: (() => void) | null = null;

  constructor(private back: BackService) {}

  onGrabDown(ev: PointerEvent): void {
    if (this.dragPointerId !== null) return;
    this.dragPointerId = ev.pointerId;
    this.dragStartY = ev.clientY;
    this.dragStartTime = ev.timeStamp;
    this.dragging = true;
    this.settling = false;
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
  }

  onGrabMove(ev: PointerEvent): void {
    if (ev.pointerId !== this.dragPointerId) return;
    // Solo se arrastra hacia abajo; hacia arriba se queda en reposo.
    this.dragY = Math.max(0, ev.clientY - this.dragStartY);
  }

  onGrabUp(ev: PointerEvent): void {
    if (ev.pointerId !== this.dragPointerId) return;
    this.dragPointerId = null;
    this.dragging = false;

    const elapsed = Math.max(1, ev.timeStamp - this.dragStartTime);
    const velocity = this.dragY / elapsed;
    if (this.dragY >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY) {
      this.dragY = 0;
      this.closed.emit();
      return;
    }

    // No alcanzó el umbral: vuelve a su sitio con transición corta.
    this.settling = true;
    this.dragY = 0;
    this.settleTimer = setTimeout(() => {
      this.settling = false;
      this.settleTimer = null;
    }, 200);
  }

  ngOnInit(): void {
    // 7A: el back físico cierra el sheet antes de navegar.
    this.unregisterBack = this.back.register(() => {
      this.closed.emit();
      return true;
    });
  }

  ngOnDestroy(): void {
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
