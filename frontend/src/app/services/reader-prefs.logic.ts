/**
 * Preferencias de tamaño y modo del lector. Puras: sin Angular ni DOM.
 * La clave viva es `reader.prefs.v1`. `dv.settings` no se escribe.
 * El servicio aplica el resultado al documento y a la barra de estado.
 */

export type ReaderTheme = 'mono' | 'claro' | 'sepia' | 'oscuro' | 'system';
export type ReaderFont = 'serif' | 'sans';

/**
 * Idioma preferido del contenido del corpus (`es`, `la`, …) o `system`
 * (sigue `navigator.language`). No es el idioma de la interfaz.
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
   * Idioma de la interfaz (menús, chrome). Independiente del corpus.
   * Valores: `es` | `en` | `zh` | `hi` | `ar`.
   */
  uiLocale: UiLocalePref;
}

export const READER_PREFS_STORAGE_KEY = 'reader.prefs.v1';

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: 'mono',
  font: 'serif',
  fontSizePx: 18,
  lineHeight: 1.65,
  maxWidthCh: 65,
  keepAwake: false,
  contentLocale: 'system',
  /** Placeholder; first load / reset use the device locale. */
  uiLocale: 'es',
};

export const THEME_CYCLE: ReaderTheme[] = [
  'mono',
  'claro',
  'sepia',
  'oscuro',
  'system',
];

export const FONT_CYCLE: ReaderFont[] = ['serif', 'sans'];

/** Valores guardados por versiones previas de la app. */
const LEGACY_THEME_MAP: Record<string, ReaderTheme> = {
  // El monocromo oscuro prima sobre el tipo papel.
  paper: 'mono',
  night: 'oscuro',
};

export function clampUiLocale(raw: string | null | undefined): UiLocalePref {
  const code = (raw ?? 'es').toString().trim().toLowerCase().split(/[-_]/)[0];
  return (UI_LOCALE_CODES as readonly string[]).includes(code)
    ? (code as UiLocalePref)
    : 'es';
}

function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampLineHeight(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_READER_PREFERENCES.lineHeight;
  }
  const rounded = Math.round(value * 100) / 100;
  return Math.min(2.0, Math.max(1.4, rounded));
}

/** Tamaño, interlineado, ancho, tema y fuente dentro de los topes del lector. */
export function clampReaderPreferences(
  prefs: ReaderPreferences,
): ReaderPreferences {
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
    fontSizePx: clampInt(
      prefs.fontSizePx,
      14,
      28,
      DEFAULT_READER_PREFERENCES.fontSizePx,
    ),
    lineHeight: clampLineHeight(prefs.lineHeight),
    maxWidthCh: clampInt(
      prefs.maxWidthCh,
      55,
      80,
      DEFAULT_READER_PREFERENCES.maxWidthCh,
    ),
    keepAwake: prefs.keepAwake === true,
    contentLocale,
    uiLocale: clampUiLocale(prefs.uiLocale),
  };
}

/** Mezcla un cambio parcial y lo deja dentro de los topes. */
export function mergeReaderPreferences(
  current: ReaderPreferences,
  partial: Partial<ReaderPreferences>,
): ReaderPreferences {
  return clampReaderPreferences({ ...current, ...partial });
}
