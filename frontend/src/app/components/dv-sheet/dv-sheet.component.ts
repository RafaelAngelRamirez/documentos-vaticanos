import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { BackService } from 'src/app/services/back.service';
import {
  SheetGestureState,
  sheetGestureBegin,
  sheetGestureEnd,
  sheetGestureMove,
} from './sheet-dismiss.logic';

/**
 * Bottom sheet del diseño (3E nota, 3F cita, 4B descargas…):
 * backdrop + .sheet con asa (.grab). El aspecto visual viene de las
 * clases globales del handoff; aquí solo el posicionamiento overlay.
 * Arrastrar la hoja hacia abajo la cierra. Si el gesto nace en un
 * scroller que no está arriba, el texto se queda el desplazamiento.
 */
@Component({
  standalone: true,
  selector: 'dv-sheet',
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <div
      #panel
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label"
      [class.dragging]="dragging"
      [class.settling]="settling"
      [style.transform]="dragY > 0 ? 'translateY(' + dragY + 'px)' : ''"
      (pointerdown)="onSheetDown($event)"
      (pointermove)="onSheetMove($event)"
      (pointerup)="onSheetUp($event)"
      (pointercancel)="onSheetUp($event)"
    >
      <div class="grab-hit">
        <div class="grab"></div>
      </div>
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
        touch-action: pan-y;
        overscroll-behavior: contain;
      }
      .sheet.dragging {
        animation: none;
        transition: none;
        touch-action: none;
      }
      .sheet.settling {
        transition: transform 0.18s ease-out;
      }
      .grab-hit {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        margin: 0 0 8px;
        touch-action: none;
        cursor: grab;
      }
      .grab-hit .grab {
        margin: 0;
      }
      .sheet.dragging .grab-hit {
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
export class DvSheetComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() label = 'Panel';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  dragging = false;
  settling = false;
  dragY = 0;

  private gesture: SheetGestureState | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private clickShieldTimer: ReturnType<typeof setTimeout> | null = null;
  private clickShield: ((ev: Event) => void) | null = null;
  private unregisterBack: (() => void) | null = null;

  private readonly onTouchMove = (ev: TouchEvent): void => {
    if (!this.dragging) return;
    if (ev.cancelable) ev.preventDefault();
  };

  constructor(private back: BackService) {}

  onSheetDown(ev: PointerEvent): void {
    if (this.gesture) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const panel = this.panel?.nativeElement;
    if (!panel) return;
    const target = ev.target instanceof Element ? ev.target : null;
    const fromGrab = !!target?.closest('.grab-hit');
    const fromField = !!target?.closest(
      'textarea, input, select, [contenteditable="true"]',
    );
    const next = sheetGestureBegin({
      pointerId: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
      time: ev.timeStamp,
      scrollTop: this.scrollTopWithin(target, panel),
      fromGrab,
      fromField,
    });
    if (!next) return;
    this.clearSettle();
    this.gesture = next;
    this.dragging = next.phase === 'drag';
    if (this.dragging) this.capture(ev);
  }

  onSheetMove(ev: PointerEvent): void {
    if (!this.gesture || ev.pointerId !== this.gesture.pointerId) return;
    const prev = this.gesture.phase;
    const next = sheetGestureMove(this.gesture, {
      x: ev.clientX,
      y: ev.clientY,
    });
    if (next.phase === 'scroll') {
      this.gesture = null;
      this.dragging = false;
      this.dragY = 0;
      return;
    }
    this.gesture = next;
    if (next.phase !== 'drag') return;
    this.dragging = true;
    this.settling = false;
    this.dragY = next.y;
    if (prev !== 'drag') this.capture(ev);
    if (ev.cancelable) ev.preventDefault();
  }

  onSheetUp(ev: PointerEvent): void {
    if (!this.gesture || ev.pointerId !== this.gesture.pointerId) return;
    const end = sheetGestureEnd(this.gesture, ev.timeStamp);
    this.gesture = null;
    this.dragging = false;
    if (end.blockClick) this.armClickShield();
    if (end.close) {
      this.dragY = 0;
      this.closed.emit();
      return;
    }
    if (end.spring) {
      this.settling = true;
      this.dragY = 0;
      this.settleTimer = setTimeout(() => {
        this.settling = false;
        this.settleTimer = null;
      }, 200);
      return;
    }
    this.dragY = 0;
  }

  ngOnInit(): void {
    // 7A: el back físico cierra el sheet antes de navegar.
    this.unregisterBack = this.back.register(() => {
      this.closed.emit();
      return true;
    });
  }

  ngAfterViewInit(): void {
    this.panel?.nativeElement.addEventListener('touchmove', this.onTouchMove, {
      passive: false,
    });
  }

  ngOnDestroy(): void {
    this.unregisterBack?.();
    this.unregisterBack = null;
    this.panel?.nativeElement.removeEventListener('touchmove', this.onTouchMove);
    this.clearSettle();
    this.clearClickShield();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  private scrollTopWithin(target: Element | null, boundary: HTMLElement): number | null {
    let el: Element | null = target;
    while (el && el !== boundary) {
      if (el instanceof HTMLElement) {
        const oy = getComputedStyle(el).overflowY;
        const scrolls = oy === 'auto' || oy === 'scroll' || oy === 'overlay';
        if (scrolls && el.scrollHeight > el.clientHeight + 1) return el.scrollTop;
      }
      el = el.parentElement;
    }
    return null;
  }

  private capture(ev: PointerEvent): void {
    const panel = this.panel?.nativeElement;
    if (!panel) return;
    try {
      panel.setPointerCapture(ev.pointerId);
    } catch {
      /* el puntero ya no está activo */
    }
  }

  private clearSettle(): void {
    this.settling = false;
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  /** El click que sigue a un arrastre no debe activar lo que quedó debajo. */
  private armClickShield(): void {
    this.clearClickShield();
    const stop = (ev: Event): void => {
      ev.preventDefault();
      ev.stopPropagation();
      this.clearClickShield();
    };
    this.clickShield = stop;
    document.addEventListener('click', stop, true);
    this.clickShieldTimer = setTimeout(() => this.clearClickShield(), 400);
  }

  private clearClickShield(): void {
    if (this.clickShield) {
      document.removeEventListener('click', this.clickShield, true);
      this.clickShield = null;
    }
    if (this.clickShieldTimer !== null) {
      clearTimeout(this.clickShieldTimer);
      this.clickShieldTimer = null;
    }
  }
}
