import { Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { parentPathForAppUrl } from 'src/app/core/santoral/santoral-units.logic';
import { NavigationService } from './navigation.service';

/**
 * Un back-handler devuelve `true` si consumió el gesto de volver
 * (p. ej. cerró un sheet o un popover abierto).
 */
export type BackHandler = () => boolean;

interface BackTrapState {
  __dvBackSentinel: true;
  __dvSeq: number;
}

interface BackNavigateEvent extends Event {
  navigationType?: string;
  destination?: { index?: number };
}

interface BackNavigation {
  currentEntry?: { index?: number } | null;
  addEventListener(
    type: 'navigate',
    listener: (event: BackNavigateEvent) => void,
  ): void;
}

/** Ventana del doble-back para salir (7A del handoff). */
const EXIT_WINDOW_MS = 2000;
const TOAST_MS = 2000;

/**
 * 7A · MAPA DE BACK — back físico/gesto de Android y botón atrás del
 * navegador unificados en un solo flujo predecible:
 *
 *   1. Último overlay abierto (popover de selección, dv-sheet…) — pila LIFO
 *      de handlers registrados con `register()`.
 *   2. Pila de citas del lector (`NavigationService.goBack()`, solo en
 *      `/leyendo/…`) — «Volver a la cita».
 *   3. Jerarquía natural de pantallas: lector → documento → biblioteca →
 *      inicio; raíces de la bnav y páginas sueltas → inicio.
 *   4. En inicio: doble-back con aviso «Pulsa atrás de nuevo para salir».
 *
 * Fuentes: `App.addListener('backButton')` en Capacitor (Android) y, en
 * web/PWA, un centinela de historial. El botón atrás del navegador (y el
 * de Android sobre la PWA) no puede descargar el documento mientras haya
 * jerarquía: el centinela hace que ese gesto sea un `popstate` del mismo
 * documento. Lo atendemos en fase capture, antes de que el `Router` de
 * Angular sincronice la URL y deje la sesión. El estado del centinela no
 * copia `navigationId` ni `ɵrouterPageId`: si se copian, Angular calcula
 * un salto de historial y el gesto sale de la app.
 */
@Injectable({ providedIn: 'root' })
export class BackService {
  private handlers: BackHandler[] = [];
  private lastBackAt = 0;
  private toastEl: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  /** Evita salir mientras el gesto aún recorre la jerarquía. */
  private allowLeave = false;
  /** Un mismo gesto dispara `navigate` y `popstate`; se atiende una vez. */
  private trap = false;
  private seq = 0;

  constructor(
    private router: Router,
    private navigation: NavigationService,
    private zone: NgZone
  ) {}

  /**
   * Arranca las fuentes del back. Idempotente; se llama una vez desde
   * `AppComponent`.
   */
  init(): void {
    if (this.started || typeof window === 'undefined') {
      return;
    }
    this.started = true;

    if (Capacitor.isNativePlatform()) {
      App.addListener('backButton', () => {
        this.zone.run(() => {
          if (!this.handleBack()) {
            this.exit();
          }
        });
      });
      return;
    }

    // Web/PWA. Capture corre antes del listener del Router (bubble).
    window.addEventListener('popstate', this.onPopState, true);
    const nav = this.webNavigation();
    nav?.addEventListener('navigate', this.onNavigate);
    window.addEventListener('pageshow', this.onPageShow);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.armSentinel();
      }
    });
    // La navegación inicial del Router puede hacer replaceState en el
    // mismo turno en que se construye el servicio. El centinela va después.
    queueMicrotask(() => this.armSentinel());
  }

  /**
   * Registra un handler de back (sheets/popovers al abrirse).
   * @returns función para des-registrarlo (al cerrarse/destruirse).
   */
  register(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) {
        this.handlers.splice(i, 1);
      }
    };
  }

  /**
   * Ejecuta un paso de "volver".
   * @returns `false` solo cuando corresponde salir de la app.
   */
  handleBack(): boolean {
    // 1. Overlays (LIFO).
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      if (this.handlers[i]()) {
        return true;
      }
    }

    const url = this.cleanUrl();

    // 2. Pila de citas, solo dentro del lector.
    if (url.startsWith('/leyendo/') && this.navigation.canGoBack()) {
      if (this.navigation.goBack()) {
        return true;
      }
    }

    // 3. Jerarquía de pantallas.
    const parent = this.parentUrl(url);
    if (parent) {
      this.router.navigateByUrl(parent);
      return true;
    }

    // 4. Raíz: doble-back para salir.
    const now = Date.now();
    if (now - this.lastBackAt <= EXIT_WINDOW_MS) {
      this.hideToast();
      return false;
    }
    this.lastBackAt = now;
    this.showToast('Pulsa atrás de nuevo para salir');
    return true;
  }

  /**
   * Ruta "padre" en la jerarquía de la app, o `null` en la raíz.
   * Expuesto para specs. Source of truth: parentPathForAppUrl (pure).
   * Saint bios (`santoral:{id}`) → `/santoral/{id}`, not broken `/documento/…`.
   */
  parentUrl(url: string): string | null {
    return parentPathForAppUrl(url);
  }

  // ------------------------------------------------------------------
  // Web: centinela de historial
  // ------------------------------------------------------------------

  private readonly onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) this.armSentinel();
  };

  /**
   * Chrome (Android y escritorio) avisa el atrás en `navigate` antes de
   * confirmar el salto. Si se puede cancelar, el documento no se descarga
   * y la jerarquía decide. Si no se puede, el `popstate` de abajo lo cubre.
   */
  private readonly onNavigate = (event: BackNavigateEvent): void => {
    if (this.allowLeave || this.trap) return;
    if (event.navigationType !== 'traverse') return;
    const dest = event.destination?.index;
    const cur = this.webNavigation()?.currentEntry?.index;
    if (typeof dest === 'number' && typeof cur === 'number' && dest > cur) {
      return;
    }
    if (!event.cancelable) return;
    try {
      event.preventDefault();
    } catch {
      return;
    }
    this.consumeBack();
  };

  private readonly onPopState = (event: PopStateEvent): void => {
    if (this.allowLeave) return;
    const incoming = this.seqOf(event.state);
    if (incoming > this.seq) {
      this.seq = incoming;
      return;
    }
    event.stopImmediatePropagation();
    this.restoreSentinel();
    if (this.trap) return;
    this.consumeBack();
  };

  private consumeBack(): void {
    if (this.trap) return;
    this.trap = true;
    try {
      this.zone.run(() => {
        if (!this.handleBack()) this.exit();
      });
    } finally {
      queueMicrotask(() => {
        this.trap = false;
      });
    }
  }

  private armSentinel(): void {
    if (this.allowLeave) return;
    if (this.isTrap(history.state)) return;
    try {
      this.pushTrap(this.appHref());
    } catch {
      // history puede fallar en contextos embebidos; el back nativo sigue.
    }
  }

  /** El pop ya movió la URL. La devolvemos al documento que seguía abierto. */
  private restoreSentinel(): void {
    try {
      this.pushTrap(this.appHref());
    } catch {
      /* el consumeBack sigue con la jerarquía */
    }
  }

  private pushTrap(url: string): void {
    this.seq += 1;
    const state: BackTrapState = { __dvBackSentinel: true, __dvSeq: this.seq };
    history.pushState(state, '', url);
  }

  private appHref(): string {
    const raw = this.router.url || '/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  private isTrap(state: unknown): boolean {
    return !!state && (state as { __dvBackSentinel?: boolean }).__dvBackSentinel === true;
  }

  private seqOf(state: unknown): number {
    const seq = (state as { __dvSeq?: number } | null)?.__dvSeq;
    return typeof seq === 'number' ? seq : 0;
  }

  private webNavigation(): BackNavigation | null {
    const nav = (window as Window & { navigation?: BackNavigation }).navigation;
    return nav && typeof nav.addEventListener === 'function' ? nav : null;
  }

  private exit(): void {
    this.hideToast();
    if (Capacitor.isNativePlatform()) {
      App.exitApp();
      return;
    }
    // Raíz confirmada: el siguiente salto de historial puede salir.
    this.allowLeave = true;
    const steps = Math.max(1, history.length);
    setTimeout(() => {
      try {
        history.go(-steps);
      } catch {
        /* sin historial previo: no-op */
      }
    }, 0);
  }

  // ------------------------------------------------------------------
  // Toast de salida (tokens del sistema, ver .dv-toast en styles.css)
  // ------------------------------------------------------------------

  private showToast(message: string): void {
    this.hideToast();
    if (typeof document === 'undefined') {
      return;
    }
    const el = document.createElement('div');
    el.className = 'dv-toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    this.toastEl = el;
    this.toastTimer = setTimeout(() => this.hideToast(), TOAST_MS);
  }

  private hideToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastEl?.remove();
    this.toastEl = null;
  }

  private cleanUrl(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }
}
