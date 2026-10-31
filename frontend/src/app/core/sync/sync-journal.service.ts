/**
 * Diario local-first: escribe ops, proyecta a localStorage y exporta .dvdelta.
 * Sin red. El merge HTTP (`SyncService`) sigue aparte.
 */

import { Injectable } from '@angular/core';
import { SyncJournalIdbStore } from './sync-journal-idb.store';
import {
  ANOTACIONES_KEY,
  FAVS_KEY,
  LAST_READ_KEY,
  Op,
  TEMAS_KEY,
  applyOps,
  buildDvDelta,
  coleccionFromAnotacionKind,
  emptyApplyState,
  emitOp,
  migrateLocalKeysToOps,
  parseDvDelta,
  projectEntities,
  serializeDvDelta,
  writeProjectionToStore,
  type JournalMeta,
} from './sync-journal.logic';

export interface AnotacionJournalInput {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  excerpt: string;
  nota?: string;
  kind: 'subrayado' | 'nota' | 'marcador';
  createdAt: number;
  updatedAt?: string;
}

export interface TemaJournalInput {
  id: string;
  title: string;
  description?: string | null;
  coverImageKey?: string | null;
  visibility?: string;
  reviewStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  steps?: Array<{
    id?: string;
    order: number;
    documentId: string;
    unitIndex: number;
    unitLabel?: string | null;
    userComment?: string | null;
    updatedAt?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class SyncJournalService {
  private ready: Promise<void> | null = null;
  private meta: JournalMeta | null = null;
  /** Memoria de ops ya cargadas (espejo del IDB). */
  private ops: Op[] = [];
  private migrated = false;

  constructor(private store: SyncJournalIdbStore) {}

  /** Arranque perezoso: meta + migración one-shot desde claves LS. */
  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.bootstrap().catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    this.meta = await this.store.ensureMeta();
    this.ops = await this.store.listOps();
    if (!this.ops.length && !this.migrated) {
      await this.migrateFromLocalStorage();
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    if (!this.meta) return;
    const anotaciones = this.readJson<Record<string, unknown>[]>(ANOTACIONES_KEY) || [];
    const temas = this.readJson<Record<string, unknown>[]>(TEMAS_KEY) || [];
    const favoritos = this.readJson<string[]>(FAVS_KEY) || [];
    const lastRead = this.readJson<Record<string, unknown>>(LAST_READ_KEY);
    if (
      !anotaciones.length &&
      !temas.length &&
      !favoritos.length &&
      !lastRead
    ) {
      this.migrated = true;
      return;
    }
    const { ops, meta } = migrateLocalKeysToOps(
      this.meta,
      { anotaciones, temas, favoritos, lastRead },
      Date.now(),
    );
    if (ops.length) {
      await this.store.appendOps(ops);
      await this.store.writeMeta(meta);
      this.ops = this.ops.concat(ops);
      this.meta = meta;
    }
    this.migrated = true;
  }

  private readJson<T>(key: string): T | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private async appendLocal(
    partial: Omit<Op, 'opId' | 'peerId' | 'seq' | 'hlc' | 'groupId'>,
    nowWall: number = Date.now(),
  ): Promise<Op | null> {
    try {
      await this.ensureReady();
      if (!this.meta) return null;
      const { op, meta } = emitOp({ meta: this.meta, nowWall }, partial);
      await this.store.appendOps([op]);
      await this.store.writeMeta(meta);
      this.ops.push(op);
      this.meta = meta;
      return op;
    } catch {
      return null;
    }
  }

  /** Dual-write: alta/edición de anotación. */
  recordAnotacionPoner(a: AnotacionJournalInput): void {
    const wall =
      Date.parse(a.updatedAt || '') || a.createdAt || Date.now();
    void this.appendLocal(
      {
        coleccion: coleccionFromAnotacionKind(a.kind),
        entityId: a.id,
        tipo: 'poner',
        valor: {
          documentId: a.documentId,
          unitIndex: a.unitIndex,
          unitLabel: a.unitLabel,
          excerpt: a.excerpt,
          nota: a.nota,
          kind: a.kind,
          createdAt: a.createdAt,
        },
        ancla: {
          documentId: a.documentId,
          unitIndex: a.unitIndex,
          unitLabel: a.unitLabel,
          excerpt: a.excerpt,
        },
      },
      wall,
    );
  }

  /** Dual-write: borrado con lápida. */
  recordAnotacionLapida(
    id: string,
    kind: 'subrayado' | 'nota' | 'marcador' = 'nota',
  ): void {
    void this.appendLocal({
      coleccion: coleccionFromAnotacionKind(kind),
      entityId: id,
      tipo: 'lapida',
    });
  }

  recordTemaPoner(tema: TemaJournalInput): void {
    const wall = Date.parse(tema.updatedAt || '') || Date.now();
    void this.appendLocal(
      {
        coleccion: 'tema',
        entityId: tema.id,
        tipo: 'poner',
        valor: {
          title: tema.title,
          description: tema.description ?? null,
          coverImageKey: tema.coverImageKey ?? null,
          visibility: tema.visibility ?? 'private',
          reviewStatus: tema.reviewStatus ?? 'none',
          createdAt: tema.createdAt,
        },
      },
      wall,
    );
    (tema.steps || []).forEach((s, i) => {
      const stepId = s.id || `${tema.id}:paso:${i}`;
      const sWall = Date.parse(s.updatedAt || '') || wall;
      void this.appendLocal(
        {
          coleccion: 'paso',
          entityId: stepId,
          tipo: 'poner',
          valor: {
            temaId: tema.id,
            order: s.order ?? i,
            documentId: s.documentId,
            unitIndex: s.unitIndex,
            unitLabel: s.unitLabel ?? null,
            userComment: s.userComment ?? null,
          },
        },
        sWall,
      );
    });
  }

  recordTemaLapida(id: string): void {
    void this.appendLocal({
      coleccion: 'tema',
      entityId: id,
      tipo: 'lapida',
    });
  }

  recordFavoritoPoner(documentId: string): void {
    void this.appendLocal({
      coleccion: 'favorito',
      entityId: documentId,
      tipo: 'poner',
      valor: documentId,
    });
  }

  recordFavoritoLapida(documentId: string): void {
    void this.appendLocal({
      coleccion: 'favorito',
      entityId: documentId,
      tipo: 'lapida',
    });
  }

  recordLectura(entry: {
    documentId: string;
    title: string;
    unitIndex: number;
    unitCount: number;
    label?: string;
    updatedAt?: string;
  }): void {
    const wall = Date.parse(entry.updatedAt || '') || Date.now();
    void this.appendLocal(
      {
        coleccion: 'lectura',
        entityId: entry.documentId,
        tipo: 'poner',
        valor: {
          title: entry.title,
          unitIndex: entry.unitIndex,
          unitCount: entry.unitCount,
          label: entry.label,
        },
      },
      wall,
    );
  }

  /** Exporta el diario completo como archivo `.dvdelta` (sin red). */
  async exportarDelta(): Promise<void> {
    await this.ensureReady();
    if (!this.meta) throw new Error('Diario no disponible.');
    const delta = buildDvDelta(this.ops, this.meta.groupId);
    const blob = new Blob([serializeDvDelta(delta)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const stamp = `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}`;
    a.download = `documentos-vaticanos-diario-${stamp}.dvdelta`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Importa un `.dvdelta`: aplica ops, avanza el vector y repinta proyección.
   * No toca auth ni preferencias de narrador.
   */
  async importarDelta(file: File): Promise<{ aplicadas: number }> {
    await this.ensureReady();
    if (!this.meta) throw new Error('Diario no disponible.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('El archivo seleccionado no es un JSON válido.');
    }
    const delta = parseDvDelta(parsed);
    const before = this.ops.length;
    const state = applyOps(
      emptyApplyState(this.meta.peerId, Date.now()),
      this.ops.concat(delta.ops),
      Date.now(),
    );
    // Persist only ops we did not already have.
    const known = new Set(this.ops.map((o) => o.opId));
    const fresh = delta.ops.filter((o) => !known.has(o.opId));
    if (fresh.length) {
      await this.store.appendOps(fresh);
      this.ops = this.ops.concat(fresh);
    }
    // Adoptar groupId del delta si aún no hemos escrito nada propio útil
    // (primer emparejamiento por archivo).
    if (delta.groupId && delta.groupId !== this.meta.groupId && before === 0) {
      this.meta = { ...this.meta, groupId: delta.groupId };
      await this.store.writeMeta(this.meta);
    }
    const projection = projectEntities(state.entities);
    if (typeof localStorage !== 'undefined') {
      writeProjectionToStore(localStorage, projection);
    }
    return { aplicadas: fresh.length };
  }
}
