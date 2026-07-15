import { Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NavigationService } from './navigation.service';

/**
 * Un back-handler devuelve `true` si consumió el gesto de volver
 * (p. ej. cerró un sheet o un popover abierto).
 */
export type BackHandler = () => boolean;

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
 * Fuentes: `App.addListener('backButton')` en Capacitor (Android) y un
 * centinela `history.pushState` + `popstate` en web/PWA.
 */
@Injectable({ providedIn: 'root' })
export class BackService {
  private handlers: BackHandler[] = [];
  private lastBackAt = 0;
  private toastEl: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

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

    // Web/PWA: centinela en el historial para interceptar el botón atrás.
    this.armSentinel();
    window.addEventListener('popstate', this.onPopState);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.armSentinel();
      }
    });
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
   * Expuesto para specs.
   */
  parentUrl(url: string): string | null {
    const seg = url.split('/').filter(Boolean);
    if (seg.length === 0 || url === '/inicio') {
      return null;
    }

    const [a, b, c] = seg;

    if (a === 'leyendo' && b) {
      return `/documento/${b}`;
    }
    if (a === 'documento') {
      return '/biblioteca';
    }
    if (a === 'estudios' && c === 'editar') {
      return `/estudios/${b}`;
    }
    if (a === 'estudios' && b) {
      return '/estudios';
    }
    if (a === 'cuenta' && b === 'temas' && c) {
      return '/cuenta/temas';
    }
    if (a === 'cuenta' && b) {
      return '/cuenta';
    }
    if (a === 'padres' && b) {
      return '/padres';
    }
    if (a === 'admin' && b === 'revision' && c) {
      return '/admin/revision';
    }

    // Raíces de bnav y páginas de primer nivel.
    return '/inicio';
  }

  // ------------------------------------------------------------------
  // Web: centinela de historial
  // ------------------------------------------------------------------

  private readonly onPopState = (): void => {
    // El navegador ya sacó el centinela; decidimos nosotros.
    this.zone.run(() => {
      if (this.handleBack()) {
        // Nos quedamos: re-armar el centinela.
        this.armSentinel();
      } else {
        this.exit();
      }
    });
  };

  private armSentinel(): void {
    try {
      const state = history.state ?? {};
      if (!state.__dvBackSentinel) {
        history.pushState(
          { ...state, __dvBackSentinel: true },
          '',
          location.href
        );
      }
    } catch {
      // history puede fallar en contextos embebidos; el back nativo sigue.
    }
  }

  private exit(): void {
    this.hideToast();
    if (Capacitor.isNativePlatform()) {
      App.exitApp();
      return;
    }
    // Web: dejar salir hacia la entrada previa a la app (si existe).
    try {
      history.back();
    } catch {
      /* sin historial previo: no-op */
    }
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
