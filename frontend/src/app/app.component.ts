import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  animate,
  group,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { AppUpdateService } from './core/downloads/app-update.service';
import { SafeAreaService } from './core/shell/safe-area.service';
import { BackService } from './services/back.service';

/**
 * F6 · Fade-through entre rutas (patrón Material): la vista saliente se
 * desvanece rápido y la entrante aparece con un leve desplazamiento.
 * Con `prefers-reduced-motion` el trigger se desactiva por completo.
 */
export const routeFade = trigger('routeFade', [
  transition('* <=> *', [
    query(
      ':enter, :leave',
      style({ position: 'absolute', inset: 0 }),
      { optional: true }
    ),
    query(':enter', style({ opacity: 0, transform: 'translateY(8px)' }), {
      optional: true,
    }),
    group([
      query(':leave', animate('90ms ease-in', style({ opacity: 0 })), {
        optional: true,
      }),
      query(
        ':enter',
        animate(
          '210ms 90ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
        { optional: true }
      ),
    ]),
  ]),
]);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [routeFade],
})
export class AppComponent {
  /** F6: con reduced-motion las rutas cambian sin animación. */
  readonly reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    back: BackService,
    appUpdate: AppUpdateService,
    safeArea: SafeAreaService
  ) {
    // 7A · Back predecible (Android + web) — una sola inicialización.
    back.init();
    // Edge-to-edge: re-apply Android bridge insets onto CSS variables.
    safeArea.init();
    // APK / Electron: consultan manifest remoto (no-op en navegador web).
    // Inyectar el servicio dispara el check en su constructor; re-assert aquí
    // por si el árbol de providers se rehidrata sin re-construir el singleton.
    appUpdate.checkForUpdate();
  }

  prepareRoute(outlet: RouterOutlet): string {
    if (!outlet || !outlet.isActivated) return '';
    return (
      outlet.activatedRouteData?.['animation'] ??
      outlet.activatedRoute?.snapshot?.routeConfig?.path ??
      ''
    );
  }
}
