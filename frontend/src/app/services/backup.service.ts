import { Injectable } from '@angular/core';
import { READER_PREFS_STORAGE_KEY } from './reader-preferences.service';

/**
 * Claves de localStorage incluidas en la copia de seguridad.
 * Se leen y escriben POR NOMBRE DE CLAVE (sin inyectar los servicios
 * propietarios) para no interferir con su estado en memoria; tras una
 * importación se recarga la página para que cada servicio relea su clave.
 */
const ANOTACIONES_STORAGE_KEY = 'dv_anotaciones_v1'; // anotaciones.service.ts
const TEMAS_STORAGE_KEY = 'themes.user'; // core/account/themes.service.ts (F8b)
const PREFERENCIAS_STORAGE_KEY = READER_PREFS_STORAGE_KEY; // 'reader.prefs.v1'

const BACKUP_APP = 'documentos-vaticanos';
const BACKUP_VERSION = 1;

export interface BackupData {
  /** Anotaciones (notas y subrayados) de `dv_anotaciones_v1`. */
  anotaciones: unknown[] | null;
  /** Temas de usuario offline-first (F8b) de `themes.user`. */
  temas: unknown[] | null;
  /** Preferencias de lectura de `reader.prefs.v1`. */
  preferencias: Record<string, unknown> | null;
}

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export interface ResumenImport {
  /** Nº de anotaciones restauradas. */
  anotaciones: number;
  /** Nº de temas restaurados. */
  temas: number;
  /** Si se restauraron las preferencias de lectura. */
  preferencias: boolean;
}

/**
 * Migraciones de formato v(n) → v(n+1). Cuando BACKUP_VERSION suba a N,
 * añadir aquí las transformaciones encadenadas 1→2, 2→3, … N-1→N.
 */
const MIGRACIONES: Record<number, (data: BackupData) => BackupData> = {};

/**
 * F8c · Export/import versionado de los datos locales del lector.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  /** Genera y descarga `documentos-vaticanos-backup-YYYYMMDD.json`. */
  exportar(): void {
    const backup: BackupFile = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        anotaciones: this.leerJson<unknown[]>(ANOTACIONES_STORAGE_KEY),
        temas: this.leerJson<unknown[]>(TEMAS_STORAGE_KEY),
        preferencias: this.leerJson<Record<string, unknown>>(
          PREFERENCIAS_STORAGE_KEY
        ),
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentos-vaticanos-backup-${this.fechaCompacta()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Valida e importa una copia de seguridad. Escribe las claves en
   * localStorage y programa una recarga de la página (1,5 s después,
   * para que la UI pueda mostrar el resumen) de modo que los servicios
   * relean su estado.
   */
  async importar(file: File): Promise<ResumenImport> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('El archivo seleccionado no es un JSON válido.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El archivo no tiene el formato de copia de seguridad.');
    }
    const backup = parsed as Partial<BackupFile>;
    if (backup.app !== BACKUP_APP) {
      throw new Error(
        'El archivo no es una copia de seguridad de Documentos Vaticanos.'
      );
    }
    if (
      typeof backup.version !== 'number' ||
      !Number.isInteger(backup.version) ||
      backup.version < 1
    ) {
      throw new Error('La copia de seguridad no indica una versión válida.');
    }
    if (backup.version > BACKUP_VERSION) {
      throw new Error(
        `Esta copia se creó con una versión más reciente de la aplicación ` +
          `(formato v${backup.version}; esta app admite hasta v${BACKUP_VERSION}). ` +
          `Actualiza la aplicación e inténtalo de nuevo.`
      );
    }
    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('La copia de seguridad no contiene datos.');
    }

    // Migraciones encadenadas v→v+1 hasta la versión vigente.
    let data = backup.data as BackupData;
    for (let v = backup.version; v < BACKUP_VERSION; v++) {
      const migrar = MIGRACIONES[v];
      if (!migrar) {
        throw new Error(
          `No hay migración disponible del formato v${v} al v${v + 1}.`
        );
      }
      data = migrar(data);
    }

    const resumen: ResumenImport = {
      anotaciones: 0,
      temas: 0,
      preferencias: false,
    };
    if (Array.isArray(data.anotaciones)) {
      localStorage.setItem(
        ANOTACIONES_STORAGE_KEY,
        JSON.stringify(data.anotaciones)
      );
      resumen.anotaciones = data.anotaciones.length;
    }
    if (Array.isArray(data.temas)) {
      localStorage.setItem(TEMAS_STORAGE_KEY, JSON.stringify(data.temas));
      resumen.temas = data.temas.length;
    }
    if (
      data.preferencias &&
      typeof data.preferencias === 'object' &&
      !Array.isArray(data.preferencias)
    ) {
      localStorage.setItem(
        PREFERENCIAS_STORAGE_KEY,
        JSON.stringify(data.preferencias)
      );
      resumen.preferencias = true;
    }

    setTimeout(() => window.location.reload(), 1500);
    return resumen;
  }

  private leerJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private fechaCompacta(): string {
    const d = new Date();
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}${mm}${dd}`;
  }
}
