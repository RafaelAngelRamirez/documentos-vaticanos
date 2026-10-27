import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { resolveContentLocale } from '../core/corpus/document-locale.logic';
import {
  defaultUiLocaleFromDevice,
  localePrefsFromStorage,
} from '../core/i18n/ui-i18n.logic';
import {
  clampReaderPreferences,
  clampUiLocale,
  DEFAULT_READER_PREFERENCES,
  FONT_CYCLE,
  mergeReaderPreferences,
  READER_PREFS_STORAGE_KEY,
  THEME_CYCLE,
  type ContentLocalePref,
  type ReaderFont,
  type ReaderPreferences,
  type ReaderTheme,
  type UiLocalePref,
} from './reader-prefs.logic';

export type {
  ContentLocalePref,
  ReaderFont,
  ReaderPreferences,
  ReaderTheme,
  UiLocalePref,
} from './reader-prefs.logic';
export {
  DEFAULT_READER_PREFERENCES,
  READER_PREFS_STORAGE_KEY,
  THEME_CYCLE,
  UI_LOCALE_CODES,
} from './reader-prefs.logic';

export { defaultUiLocaleFromDevice };

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
    const next = mergeReaderPreferences(this.prefsSubject.value, partial);
    this.prefsSubject.next(next);
    this.persist(next);
    this.applyToDom(next);
  }

  reset(): void {
    this.update({
      ...DEFAULT_READER_PREFERENCES,
      uiLocale: defaultUiLocaleFromDevice(),
    });
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

    this.syncSystemChrome(root);
  }

  /**
   * Sincroniza el chrome del sistema (meta theme-color + StatusBar nativa)
   * con el fondo resuelto del tema. Debe ejecutarse DESPUÉS de fijar
   * data-reader-resolved, para que getComputedStyle vea los tokens nuevos.
   */
  private syncSystemChrome(root: HTMLElement): void {
    const bg =
      getComputedStyle(root).getPropertyValue('--bg').trim() || '#fdfdfb';

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = bg;

    if (Capacitor.isNativePlatform()) {
      const dark = this.isDarkColor(bg);
      // Fondo oscuro -> iconos claros (Style.Dark) y viceversa.
      StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
        () => {}
      );
    }
  }

  /** Luminancia aproximada de un color hex (#rgb o #rrggbb). */
  private isDarkColor(hex: string): boolean {
    const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) {
      return false;
    }
    let h = m[1];
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }

  /**
   * Idioma efectivo de contenido (pref + dispositivo).
   * Delegado a `resolveContentLocale` del core.
   */
  resolveContentLocale(
    prefs: ReaderPreferences = this.prefsSubject.value
  ): string {
    const nav =
      typeof navigator !== 'undefined' ? navigator.language : undefined;
    return resolveContentLocale(prefs.contentLocale, nav, 'es');
  }

  setContentLocale(contentLocale: ContentLocalePref): void {
    this.update({ contentLocale });
  }

  /** Idioma de la interfaz (`es`|`en`|`zh`|`hi`|`ar`). */
  setUiLocale(uiLocale: string): void {
    this.update({ uiLocale: clampUiLocale(uiLocale) });
  }

  private load(): ReaderPreferences {
    const nav =
      typeof navigator !== 'undefined' ? navigator.language : undefined;
    try {
      const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
      const locales = localePrefsFromStorage(raw, nav);
      if (!raw) {
        // First launch: content follows device via `system`; UI matches device.
        return {
          ...DEFAULT_READER_PREFERENCES,
          ...locales,
        };
      }
      const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
      return clampReaderPreferences({
        ...DEFAULT_READER_PREFERENCES,
        ...parsed,
        ...locales,
      });
    } catch {
      return {
        ...DEFAULT_READER_PREFERENCES,
        ...localePrefsFromStorage(null, nav),
      };
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
