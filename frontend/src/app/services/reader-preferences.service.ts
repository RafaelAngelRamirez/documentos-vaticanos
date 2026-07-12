import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Temas del diseño (Ajustes 4A): Sepia · Claro · Oscuro · Sistema. */
export type ReaderTheme = 'claro' | 'sepia' | 'oscuro' | 'system';
export type ReaderFont = 'serif' | 'sans';

export interface ReaderPreferences {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSizePx: number; // 14-28
  lineHeight: number; // 1.4-2.0
  maxWidthCh: number; // 55-80
  /** Ajustes 4A: "Mantener pantalla encendida" (Wake Lock). */
  keepAwake: boolean;
}

export const READER_PREFS_STORAGE_KEY = 'reader.prefs.v1';

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: 'claro',
  font: 'serif',
  fontSizePx: 18,
  lineHeight: 1.65,
  maxWidthCh: 65,
  keepAwake: false,
};

export const THEME_CYCLE: ReaderTheme[] = [
  'claro',
  'sepia',
  'oscuro',
  'system',
];
const FONT_CYCLE: ReaderFont[] = ['serif', 'sans'];

/** Valores guardados por versiones previas de la app. */
const LEGACY_THEME_MAP: Record<string, ReaderTheme> = {
  paper: 'claro',
  night: 'oscuro',
};

const FONT_SERIF =
  '"EB Garamond", Georgia, "Times New Roman", "Palatino Linotype", serif';
const FONT_SANS =
  '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

@Injectable({
  providedIn: 'root',
})
export class ReaderPreferencesService {
  private readonly prefsSubject = new BehaviorSubject<ReaderPreferences>(
    this.load()
  );

  readonly prefs$ = this.prefsSubject.asObservable();

  private mediaQuery?: MediaQueryList;
  private mediaListener?: (e: MediaQueryListEvent) => void;

  constructor() {
    this.applyToDom(this.prefsSubject.value);
    this.watchSystemTheme();
  }

  get snapshot(): ReaderPreferences {
    return this.prefsSubject.value;
  }

  update(partial: Partial<ReaderPreferences>): void {
    const next = this.clamp({ ...this.prefsSubject.value, ...partial });
    this.prefsSubject.next(next);
    this.persist(next);
    this.applyToDom(next);
  }

  reset(): void {
    this.update({ ...DEFAULT_READER_PREFERENCES });
  }

  setTheme(theme: ReaderTheme): void {
    this.update({ theme });
  }

  setFont(font: ReaderFont): void {
    this.update({ font });
  }

  cycleTheme(): void {
    const current = this.prefsSubject.value.theme;
    const idx = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    this.update({ theme: next });
  }

  cycleFont(): void {
    const current = this.prefsSubject.value.font;
    const idx = FONT_CYCLE.indexOf(current);
    const next = FONT_CYCLE[(idx + 1) % FONT_CYCLE.length];
    this.update({ font: next });
  }

  bumpFontSize(delta: number): void {
    this.update({
      fontSizePx: this.prefsSubject.value.fontSizePx + delta,
    });
  }

  /** Resolve claro/sepia/oscuro from prefs + system preference. */
  resolveTheme(prefs: ReaderPreferences = this.prefsSubject.value): Exclude<
    ReaderTheme,
    'system'
  > {
    if (prefs.theme !== 'system') {
      return prefs.theme;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'oscuro'
        : 'claro';
    }
    return 'claro';
  }

  applyToDom(prefs: ReaderPreferences = this.prefsSubject.value): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const resolved = this.resolveTheme(prefs);

    root.style.setProperty('--reader-font-size', `${prefs.fontSizePx}px`);
    root.style.setProperty('--reader-line-height', String(prefs.lineHeight));
    root.style.setProperty('--reader-max-width', `${prefs.maxWidthCh}ch`);
    root.style.setProperty(
      '--reader-font-family',
      prefs.font === 'serif' ? FONT_SERIF : FONT_SANS
    );

    // Keep requested theme (incl. system) and also a resolved value for CSS.
    root.setAttribute('data-reader-theme', prefs.theme);
    root.setAttribute('data-reader-resolved', resolved);
  }

  private clamp(prefs: ReaderPreferences): ReaderPreferences {
    const migrated =
      LEGACY_THEME_MAP[prefs.theme as string] ?? (prefs.theme as ReaderTheme);
    return {
      theme: THEME_CYCLE.includes(migrated) ? migrated : 'claro',
      font: FONT_CYCLE.includes(prefs.font) ? prefs.font : 'serif',
      fontSizePx: Math.min(28, Math.max(14, Math.round(prefs.fontSizePx))),
      lineHeight: Math.min(
        2.0,
        Math.max(1.4, Math.round(prefs.lineHeight * 100) / 100)
      ),
      maxWidthCh: Math.min(80, Math.max(55, Math.round(prefs.maxWidthCh))),
      keepAwake: prefs.keepAwake === true,
    };
  }

  private load(): ReaderPreferences {
    try {
      const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_READER_PREFERENCES };
      }
      const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
      return this.clamp({
        ...DEFAULT_READER_PREFERENCES,
        ...parsed,
      });
    } catch {
      return { ...DEFAULT_READER_PREFERENCES };
    }
  }

  private persist(prefs: ReaderPreferences): void {
    try {
      localStorage.setItem(READER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  private watchSystemTheme(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaListener = () => {
      if (this.prefsSubject.value.theme === 'system') {
        this.applyToDom(this.prefsSubject.value);
      }
    };
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.mediaListener);
    } else {
      // Safari < 14
      (this.mediaQuery as MediaQueryList).addListener?.(this.mediaListener);
    }
  }
}
