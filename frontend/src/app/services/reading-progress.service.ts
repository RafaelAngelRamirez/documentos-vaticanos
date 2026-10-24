import { Injectable } from '@angular/core';
import {
  SETTINGS_KEY,
  LastRead,
  LastReadInput,
  getLastReadFromStore,
  lastReadPercent,
  setLastReadInStore,
} from './reading-progress.logic';

export type { LastRead } from './reading-progress.logic';

export interface DvSettings {
  size: number;
  theme: 'sepia' | 'claro' | 'oscuro';
  font: 'serif' | 'sans';
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

  setLastRead(entry: LastReadInput): void {
    setLastReadInStore(localStorage, entry);
  }

  getLastRead(): LastRead | null {
    return getLastReadFromStore(localStorage);
  }

  /** 0–100 progress estimate from unit index. */
  percent(entry: LastRead | null | undefined): number {
    return lastReadPercent(entry);
  }
}
