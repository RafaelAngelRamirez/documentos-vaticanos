import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { resolveContentLocale } from '../core/corpus/document-locale.logic';
import {
  defaultUiLocaleFromDevice,
  localePrefsFromStorage,
} from '../core/i18n/ui-i18n.logic';

/** Temas: Mono (monocromo oscuro, default) · Sepia · Claro · Oscuro · Sistema. */
export type ReaderTheme = 'mono' | 'claro' | 'sepia' | 'oscuro' | 'system';
export type ReaderFont = 'serif' | 'sans';

/**
 * Idioma preferido del **contenido** del corpus (`es`, `la`, …) o `system`
 * (sigue `navigator.language`). No es i18n de la UI.
 */
export type ContentLocalePref = 'system' | string;

/** Idiomas de interfaz soportados (`UiI18nService` / `assets/i18n`). */
export const UI_LOCALE_CODES = ['es', 'en', 'zh', 'hi', 'ar'] as const;
export type UiLocalePref = (typeof UI_LOCALE_CODES)[number];

export interface ReaderPreferences {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSizePx: number; // 14-28
  lineHeight: number; // 1.4-2.0
  maxWidthCh: number; // 55-80
  /** Ajustes 4A: "Mantener pantalla encendida" (Wake Lock). */
  keepAwake: boolean;
  /**
   * Idioma de los textos del corpus cuando hay varias ediciones.
   * `system` → locale del dispositivo; fallback de catálogo `es`.
   */
  contentLocale: ContentLocalePref;
  /**
   * Idioma de la **interfaz** (menús, chrome). Independiente del corpus.
   * Valores: `es` | `en` | `zh` | `hi` | `ar`.
   * Sin preferencia guardada: locale del dispositivo (web/Android WebView).
   */
  uiLocale: UiLocalePref;
}

export const READER_PREFS_STORAGE_KEY = 'reader.prefs.v1';

export { defaultUiLocaleFromDevice };

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: 'mono',
  font: 'serif',
  fontSizePx: 18,
  lineHeight: 1.65,
  maxWidthCh: 65,
  keepAwake: false,
  contentLocale: 'system',
  /** Placeholder; first load / reset use {@link defaultUiLocaleFromDevice}. */
  uiLocale: 'es',
};

export const THEME_CYCLE: ReaderTheme[] = [
  'mono',
  'claro',
  'sepia',
  'oscuro',
  'system',
];
const FONT_CYCLE: ReaderFont[] = ['serif', 'sans'];

/** Valores guardados por versiones previas de la app. */
const LEGACY_THEME_MAP: Record<string, ReaderTheme> = {
  // El monocromo oscuro prima sobre el tipo papel.
  paper: 'mono',
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
    this.update({ uiLocale: this.clampUiLocale(uiLocale) });
  }

  private clampUiLocale(raw: string | null | undefined): UiLocalePref {
    const code = (raw ?? 'es').toString().trim().toLowerCase().split(/[-_]/)[0];
    return (UI_LOCALE_CODES as readonly string[]).includes(code)
      ? (code as UiLocalePref)
      : 'es';
  }

  private clamp(prefs: ReaderPreferences): ReaderPreferences {
    const migrated =
      LEGACY_THEME_MAP[prefs.theme as string] ?? (prefs.theme as ReaderTheme);
    const rawLoc = (prefs.contentLocale ?? 'system').toString().trim();
    const contentLocale: ContentLocalePref =
      !rawLoc || rawLoc === 'system'
        ? 'system'
        : rawLoc.toLowerCase().split(/[-_]/)[0] || 'system';
    return {
      theme: THEME_CYCLE.includes(migrated) ? migrated : 'mono',
      font: FONT_CYCLE.includes(prefs.font) ? prefs.font : 'serif',
      fontSizePx: Math.min(28, Math.max(14, Math.round(prefs.fontSizePx))),
      lineHeight: Math.min(
        2.0,
        Math.max(1.4, Math.round(prefs.lineHeight * 100) / 100)
      ),
      maxWidthCh: Math.min(80, Math.max(55, Math.round(prefs.maxWidthCh))),
      keepAwake: prefs.keepAwake === true,
      contentLocale,
      uiLocale: this.clampUiLocale(prefs.uiLocale),
    };
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
      return this.clamp({
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
