import { Injectable } from '@angular/core';
import {
  ClaseEnAparato,
  CLASES_STORAGE_KEY,
  CodigoClase,
  LEGACY_PROGRESO_PREFIX,
  MAX_PASOS,
  PROGRESO_STORAGE_KEY,
  PasoNuevo,
  aceptarPendiente,
  agregarPaso,
  archivoExportable,
  crearMaestro,
  descartarPendiente,
  entradaDesde,
  guardarMeta,
  incorporarArchivo,
  leidos,
  marcarLeido,
  marcarLista,
  migrarProgresoLegado,
  olvidarProgreso,
  publicar,
  quitarEntrada,
  quitarPaso,
  reordenar,
  sanearProgreso,
} from './clases.logic';

export { MAX_PASOS };
export type { ClaseEnAparato, ClaseLocal, PasoClase } from './clases.logic';

type OkEntry = { ok: true; entry: ClaseEnAparato };
type Err = { ok: false; codigo: CodigoClase };

@Injectable({ providedIn: 'root' })
export class ClasesService {
  mias(): ClaseEnAparato[] {
    return this.read()
      .filter((e) => e.papel === 'maestro')
      .sort((a, b) => (a.clase.actualizadaEn < b.clase.actualizadaEn ? 1 : -1));
  }

  alumnas(): ClaseEnAparato[] {
    return this.read()
      .filter((e) => e.papel === 'alumno')
      .sort((a, b) => (a.clase.actualizadaEn < b.clase.actualizadaEn ? 1 : -1));
  }

  get(id: string): ClaseEnAparato | null {
    return this.read().find((e) => e.clase.id === id) || null;
  }

  crear(titulo: string, descripcion?: string): OkEntry | Err {
    const hecho = crearMaestro(titulo, this.now(), this.newId(), descripcion);
    if (!hecho.ok) return hecho;
    this.write([hecho.entry, ...this.read()]);
    return hecho;
  }

  guardarMeta(id: string, titulo: string, descripcion: string): OkEntry | Err {
    return this.mapEntry(id, (e) => guardarMeta(e, titulo, descripcion, this.now()));
  }

  agregarPaso(id: string, input: PasoNuevo): OkEntry | Err {
    return this.mapEntry(id, (e) =>
      agregarPaso(e, input, this.now(), this.newId()),
    );
  }

  quitarPaso(id: string, pasoId: string): OkEntry | Err {
    return this.mapEntry(id, (e) => quitarPaso(e, pasoId, this.now()));
  }

  moverPaso(id: string, pasoId: string, dir: -1 | 1): OkEntry | Err {
    const entry = this.get(id);
    if (!entry) return { ok: false, codigo: 'paso' };
    const ids = entry.clase.pasos.map((p) => p.id);
    const i = ids.indexOf(pasoId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true, entry };
    const next = ids.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    return this.mapEntry(id, (e) => reordenar(e, next, this.now()));
  }

  marcarLista(id: string, lista: boolean): OkEntry | Err {
    return this.mapEntry(id, (e) => marcarLista(e, lista));
  }

  publicar(id: string): OkEntry | Err {
    return this.mapEntry(id, (e) => publicar(e, this.now()));
  }

  exportar(id: string): { ok: true; json: string; nombre: string } | Err {
    const entry = this.get(id);
    if (!entry) return { ok: false, codigo: 'invalida' };
    return archivoExportable(entry);
  }

  importar(
    raw: string,
  ):
    | { ok: true; codigo: 'nueva' | 'pendiente' | 'misma'; id: string }
    | { ok: false; codigo: CodigoClase } {
    const entries = this.read();
    const res = incorporarArchivo(entries, raw);
    if (res.entries !== entries) this.write(res.entries);
    if (!res.ok) return { ok: false, codigo: res.codigo };
    return { ok: true, codigo: res.codigo, id: res.id };
  }

  aceptar(id: string): OkEntry | Err {
    return this.mapEntry(id, (e) => aceptarPendiente(e));
  }

  conservar(id: string): void {
    this.mapEntry(id, (e) => ({ ok: true, entry: descartarPendiente(e) }));
  }

  borrar(id: string): void {
    this.write(quitarEntrada(this.read(), id));
    this.writeProgreso(olvidarProgreso(this.readProgreso(), id));
  }

  progreso(id: string): Record<string, true> {
    const entry = this.get(id);
    if (!entry || entry.papel !== 'alumno') return {};
    const mapa = this.readProgreso();
    let legacy: unknown | undefined;
    if (!Object.prototype.hasOwnProperty.call(mapa, id)) {
      legacy = this.readLegacy(id);
    }
    const migrated = migrarProgresoLegado(mapa, id, entry.clase.pasos, legacy);
    if (migrated.consumirLegacy) {
      this.writeProgreso(migrated.mapa);
      this.removeLegacy(id);
    }
    return migrated.mapa[id] || {};
  }

  marcarPaso(id: string, pasoId: string): void {
    const entry = this.get(id);
    if (!entry || entry.papel !== 'alumno') return;
    if (!entry.clase.pasos.some((p) => p.id === pasoId)) return;
    this.progreso(id);
    this.writeProgreso(marcarLeido(this.readProgreso(), id, pasoId));
  }

  leidosDe(entry: ClaseEnAparato): number {
    return leidos(entry.clase.pasos, this.progreso(entry.clase.id));
  }

  private mapEntry(
    id: string,
    fn: (e: ClaseEnAparato) => OkEntry | Err,
  ): OkEntry | Err {
    const entries = this.read();
    const idx = entries.findIndex((e) => e.clase.id === id);
    if (idx < 0) return { ok: false, codigo: 'invalida' };
    const res = fn(entries[idx]);
    if (!res.ok) return res;
    const next = entries.slice();
    next[idx] = res.entry;
    this.write(next);
    return res;
  }

  private read(): ClaseEnAparato[] {
    try {
      const raw = localStorage.getItem(CLASES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: ClaseEnAparato[] = [];
      for (const item of parsed) {
        const entry = entradaDesde(item);
        if (entry) out.push(entry);
      }
      return out;
    } catch {
      return [];
    }
  }

  private write(entries: ClaseEnAparato[]): void {
    try {
      localStorage.setItem(CLASES_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private readProgreso() {
    try {
      const raw = localStorage.getItem(PROGRESO_STORAGE_KEY);
      if (!raw) return {};
      return sanearProgreso(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  private writeProgreso(mapa: ReturnType<typeof sanearProgreso>): void {
    try {
      localStorage.setItem(PROGRESO_STORAGE_KEY, JSON.stringify(mapa));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private readLegacy(id: string): unknown | undefined {
    try {
      const raw = localStorage.getItem(LEGACY_PROGRESO_PREFIX + id);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    } catch {
      return undefined;
    }
  }

  private removeLegacy(id: string): void {
    try {
      localStorage.removeItem(LEGACY_PROGRESO_PREFIX + id);
    } catch {
      /* silencioso */
    }
  }

  private now(): string {
    return new Date().toISOString();
  }

  private newId(): string {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      /* sin crypto */
    }
    return (
      'local-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    );
  }
}
