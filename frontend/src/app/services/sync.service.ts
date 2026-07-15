import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * F9 · Registro = respaldo en nube; merge local→nube al iniciar sesión.
 *
 * Lee las anotaciones locales (clave `dv_anotaciones_v1`, ver
 * anotaciones.service.ts — se accede por clave, sin tocar ese servicio),
 * las envía a POST /api/v1/sync/merge (last-write-wins por `updatedAt`)
 * y escribe el estado consolidado de vuelta en localStorage.
 *
 * Los temas locales (F8b, clave `themes.user` de core/account/
 * themes.service.ts) se envían igualmente y el estado consolidado que
 * devuelve el servidor se escribe de vuelta en esa clave.
 */

/** = STORAGE_KEY de src/app/services/anotaciones.service.ts */
const ANOTACIONES_KEY = 'dv_anotaciones_v1';
/** = THEMES_STORAGE_KEY de src/app/core/account/themes.service.ts */
const TEMAS_KEY = 'themes.user';

/** Forma local (anotaciones.service.ts): createdAt epoch ms + updatedAt ISO. */
interface LocalAnotacion {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  excerpt: string;
  nota?: string;
  kind: 'subrayado' | 'nota' | 'marcador';
  createdAt: number;
  /** ISO 8601 (F8a); registros antiguos pueden no tenerlo. */
  updatedAt?: string;
}

/** Forma local mínima de un tema (core/account/themes.service.ts). */
interface LocalTema {
  id?: string;
  title?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

/** Forma servidor: fechas ISO. */
interface ServerAnotacion {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel: string | null;
  excerpt: string;
  nota: string | null;
  kind: 'subrayado' | 'nota' | 'marcador';
  createdAt: string;
  updatedAt: string;
}

interface MergeSummary {
  anotacionesCreadas: number;
  anotacionesActualizadas: number;
  anotacionesIgnoradas: number;
  temasCreados: number;
  temasActualizados: number;
  temasIgnorados: number;
}

interface MergeResponse {
  anotaciones: ServerAnotacion[];
  temas: unknown[];
  summary: MergeSummary;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  constructor(private http: HttpClient) {}

  /**
   * Merge local→nube tras login/registro. Best-effort: nunca lanza; los
   * errores se registran con console.warn y no bloquean la navegación.
   * Devuelve `true` si el merge subió algo (para mostrar el aviso).
   */
  async mergeAlIniciarSesion(): Promise<boolean> {
    if (!environment.apiBaseUrl) return false;

    try {
      const locales = this.leerAnotacionesLocales();
      const payload = {
        anotaciones: locales.map((a) => ({
          id: a.id,
          documentId: a.documentId,
          unitIndex: a.unitIndex,
          unitLabel: a.unitLabel ?? null,
          excerpt: a.excerpt,
          nota: a.nota ?? null,
          kind: a.kind,
          // F8a persiste updatedAt ISO; para registros antiguos se cae a
          // createdAt (epoch ms) como base del last-write-wins.
          updatedAt:
            a.updatedAt || new Date(a.createdAt || Date.now()).toISOString(),
        })),
        temas: this.leerTemasLocales(),
      };

      // El AuthInterceptor añade el Bearer token (URL bajo apiBaseUrl).
      const res = await firstValueFrom(
        this.http.post<MergeResponse>(
          `${environment.apiBaseUrl}/sync/merge`,
          payload
        )
      );

      this.escribirAnotacionesLocales(res.anotaciones ?? []);
      this.escribirTemasLocales(res.temas);

      const subidos =
        (res.summary?.anotacionesCreadas ?? 0) +
        (res.summary?.anotacionesActualizadas ?? 0) +
        (res.summary?.temasCreados ?? 0) +
        (res.summary?.temasActualizados ?? 0);
      if (subidos > 0) {
        this.avisar('Datos locales respaldados en tu cuenta');
      }
      return subidos > 0;
    } catch (err) {
      console.warn(
        '[sync] Merge local→nube falló; se reintentará en el próximo inicio de sesión.',
        err
      );
      return false;
    }
  }

  /** Temas locales (F8b, clave `themes.user`) listos para el merge. */
  private leerTemasLocales(): LocalTema[] {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(TEMAS_KEY)
          : null;
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // El backend exige title y updatedAt; el resto lo sanea él mismo.
      return (parsed as LocalTema[]).filter(
        (t) => t && typeof t.title === 'string' && t.title.trim().length > 0
      );
    } catch {
      return [];
    }
  }

  /** Estado consolidado de temas nube → clave local `themes.user`. */
  private escribirTemasLocales(temas: unknown): void {
    if (!Array.isArray(temas)) return;
    try {
      localStorage.setItem(TEMAS_KEY, JSON.stringify(temas));
    } catch {
      // Sin almacenamiento disponible: el estado consolidado queda en nube.
    }
  }

  private leerAnotacionesLocales(): LocalAnotacion[] {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(ANOTACIONES_KEY)
          : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as LocalAnotacion[]) : [];
    } catch {
      return [];
    }
  }

  /** Estado consolidado nube → localStorage, en la forma local. */
  private escribirAnotacionesLocales(items: ServerAnotacion[]): void {
    try {
      const locales: LocalAnotacion[] = items.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        unitIndex: a.unitIndex,
        ...(a.unitLabel ? { unitLabel: a.unitLabel } : {}),
        excerpt: a.excerpt,
        ...(a.nota ? { nota: a.nota } : {}),
        kind: a.kind,
        createdAt: new Date(a.createdAt).getTime() || Date.now(),
        updatedAt: a.updatedAt,
      }));
      // AnotacionesService antepone las más recientes: conservar ese orden.
      locales.sort((x, y) => y.createdAt - x.createdAt);
      localStorage.setItem(ANOTACIONES_KEY, JSON.stringify(locales));
    } catch {
      // Sin almacenamiento disponible: el estado consolidado queda en nube.
    }
  }

  /** Aviso breve no bloqueante (sobrevive a la navegación post-login). */
  private avisar(mensaje: string): void {
    try {
      if (typeof document === 'undefined') return;
      const el = document.createElement('div');
      el.textContent = mensaje;
      el.setAttribute('role', 'status');
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:24px',
        'transform:translateX(-50%)',
        'background:#1f2937',
        'color:#fff',
        'padding:10px 16px',
        'border-radius:8px',
        'font-size:14px',
        'z-index:9999',
        'box-shadow:0 4px 12px rgba(0,0,0,.25)',
        'opacity:0',
        'transition:opacity .3s ease',
      ].join(';');
      document.body.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = '1'));
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
      }, 4000);
    } catch {
      console.info(`[sync] ${mensaje}`);
    }
  }
}
