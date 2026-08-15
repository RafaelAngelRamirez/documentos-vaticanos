import { Injectable } from '@angular/core';

export type ReaderTheme = 'mono' | 'sepia' | 'claro' | 'oscuro' | 'system';
export type ReaderFont = 'serif' | 'sans';

export interface ReaderPrefs {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSizePx: number;
  keepAwake: boolean;
}

const KEY = 'reader.prefs.v1';
const DEFAULTS: ReaderPrefs = {
  theme: 'mono',
  font: 'serif',
  fontSizePx: 18,
  keepAwake: false,
};

@Injectable({ providedIn: 'root' })
export class ReaderPreferencesService {
  prefs: ReaderPrefs = { ...DEFAULTS };

  constructor() {
    this.load();
    this.applyToDom();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
      this.prefs = { ...DEFAULTS, ...parsed };
    } catch {
      this.prefs = { ...DEFAULTS };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
  }

  update(partial: Partial<ReaderPrefs>): void {
    this.prefs = { ...this.prefs, ...partial };
    this.save();
    this.applyToDom();
  }

  applyToDom(): void {
    if (typeof document === 'undefined') return;
    const theme = this.prefs.theme;
    document.documentElement.dataset['readerTheme'] = theme;
    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'oscuro'
        : 'claro';
    }
    document.documentElement.dataset['readerResolved'] = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg')
      .trim();
    if (meta && bg) meta.setAttribute('content', bg);
  }
}
