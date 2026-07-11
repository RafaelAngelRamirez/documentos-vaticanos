import { Injectable } from '@angular/core';

/** Keys aligned with design ARQUITECTURA.md (`dv.*`). */
const SETTINGS_KEY = 'dv.settings';
const NAV_KEY = 'dv.nav';
const LAST_READ_KEY = 'dv.lastRead';

export interface DvSettings {
  size: number;
  theme: 'sepia' | 'claro' | 'oscuro';
  font: 'serif' | 'sans';
}

export interface LastRead {
  documentId: string;
  title: string;
  unitIndex: number;
  unitCount: number;
  label?: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReadingProgressService {
  getSettings(): Partial<DvSettings> {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  saveSettings(partial: Partial<DvSettings>): void {
    const next = { ...this.getSettings(), ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  saveNav(view: string, docId?: string | null): void {
    localStorage.setItem(NAV_KEY, JSON.stringify({ view, docId: docId ?? null }));
  }

  scrollKey(docId: string): string {
    return `dv.pos.${docId}`;
  }

  saveScroll(docId: string, y: number): void {
    if (!docId) return;
    localStorage.setItem(this.scrollKey(docId), String(Math.max(0, Math.round(y))));
  }

  getScroll(docId: string): number {
    return parseFloat(localStorage.getItem(this.scrollKey(docId)) || '0') || 0;
  }

  setLastRead(entry: Omit<LastRead, 'updatedAt'>): void {
    const full: LastRead = { ...entry, updatedAt: new Date().toISOString() };
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(full));
    this.saveNav('lector', entry.documentId);
  }

  getLastRead(): LastRead | null {
    try {
      const raw = localStorage.getItem(LAST_READ_KEY);
      return raw ? (JSON.parse(raw) as LastRead) : null;
    } catch {
      return null;
    }
  }

  /** 0–100 progress estimate from unit index. */
  percent(entry: LastRead | null | undefined): number {
    if (!entry?.unitCount || entry.unitCount <= 0) return 0;
    const p = Math.round((entry.unitIndex / entry.unitCount) * 100);
    return Math.min(100, Math.max(0, p));
  }
}
