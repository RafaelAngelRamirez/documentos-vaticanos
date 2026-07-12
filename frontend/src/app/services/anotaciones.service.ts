import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type AnotacionKind = 'subrayado' | 'nota';

export interface Anotacion {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  /** Fragmento seleccionado (texto plano). */
  excerpt: string;
  /** Cuerpo de la nota (solo kind 'nota'). */
  nota?: string;
  kind: AnotacionKind;
  createdAt: number;
}

const STORAGE_KEY = 'dv_anotaciones_v1';

/**
 * Subrayados y notas privadas (diseño 4A/4B).
 * Persistencia local: «Las notas se guardan en este dispositivo».
 */
@Injectable({ providedIn: 'root' })
export class AnotacionesService {
  private subject = new BehaviorSubject<Anotacion[]>(this.load());

  readonly anotaciones$: Observable<Anotacion[]> = this.subject.asObservable();

  get snapshot(): Anotacion[] {
    return this.subject.value;
  }

  forDocument(documentId: string): Anotacion[] {
    return this.subject.value.filter((a) => a.documentId === documentId);
  }

  forUnit(documentId: string | undefined, unitIndex: number): Anotacion[] {
    if (!documentId) return [];
    return this.subject.value.filter(
      (a) => a.documentId === documentId && a.unitIndex === unitIndex
    );
  }

  /** Fragmentos a resaltar en una unidad concreta. */
  highlightsFor(documentId: string | undefined, unitIndex: number): string[] {
    return this.forUnit(documentId, unitIndex)
      .map((a) => a.excerpt)
      .filter(Boolean);
  }

  add(entry: Omit<Anotacion, 'id' | 'createdAt'>): Anotacion {
    const anotacion: Anotacion = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      createdAt: Date.now(),
    };
    this.persist([anotacion, ...this.subject.value]);
    return anotacion;
  }

  remove(id: string): void {
    this.persist(this.subject.value.filter((a) => a.id !== id));
  }

  private persist(list: Anotacion[]): void {
    this.subject.next(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Sin almacenamiento disponible (SSR/cuota): estado solo en memoria.
    }
  }

  private load(): Anotacion[] {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (a) =>
          a &&
          typeof a.documentId === 'string' &&
          typeof a.unitIndex === 'number' &&
          typeof a.excerpt === 'string'
      );
    } catch {
      return [];
    }
  }
}
