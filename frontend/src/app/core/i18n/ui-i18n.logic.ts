/**
 * UI i18n pure helpers — no Angular DI, safe for node tests.
 *
 * Catalogs live under `assets/i18n/{locale}.json` (flat key → string).
 * Spanish (`es`) is the principal fallback for missing keys/locales.
 */

export const UI_LOCALES = ['es', 'en', 'zh', 'hi', 'ar'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = 'es';

/** Flat message catalog (key → translated string). */
export type UiCatalog = Record<string, string>;

/** All loaded catalogs keyed by locale code. */
export type UiCatalogMap = Partial<Record<string, UiCatalog>>;

export function isUiLocale(code: string | null | undefined): code is UiLocale {
  if (!code) return false;
  return (UI_LOCALES as readonly string[]).includes(code);
}

/**
 * Normalize / clamp a stored or browser locale to a supported UI locale.
 * Unknown values fall back to `fallback` (default `es`).
 */
export function resolveUiLocale(
  raw?: string | null,
  fallback: UiLocale = DEFAULT_UI_LOCALE,
): UiLocale {
  if (!raw) return fallback;
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0] || '';
  if (isUiLocale(primary)) return primary;
  return isUiLocale(fallback) ? fallback : DEFAULT_UI_LOCALE;
}

/**
 * UI locale from the device (`navigator.language`) for first launch / reset.
 * Works on web and Capacitor Android WebView (same JS navigator).
 * Unsupported device languages fall back to Spanish.
 */
export function defaultUiLocaleFromDevice(
  navigatorLanguage?: string | null,
): UiLocale {
  const nav =
    navigatorLanguage !== undefined
      ? navigatorLanguage
      : typeof navigator !== 'undefined'
        ? navigator.language
        : undefined;
  return resolveUiLocale(nav);
}

/** Arabic is RTL; all other UI locales are LTR. */
export function isRtl(locale: string | null | undefined): boolean {
  return resolveUiLocale(locale) === 'ar';
}

export function dirForLocale(
  locale: string | null | undefined,
): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

/**
 * Set `lang` and `dir` on the document root (or any element).
 * Safe no-op when `root` is missing (SSR / tests without DOM).
 */
export function applyDocumentLangDir(
  root: { lang?: string; dir?: string; setAttribute?: (n: string, v: string) => void } | null | undefined,
  locale: string | null | undefined,
): void {
  if (!root) return;
  const loc = resolveUiLocale(locale);
  const dir = dirForLocale(loc);
  if (typeof root.setAttribute === 'function') {
    root.setAttribute('lang', loc);
    root.setAttribute('dir', dir);
  }
  root.lang = loc;
  root.dir = dir;
}

/**
 * Replace `{{param}}` placeholders in a template string.
 * Unknown placeholders are left intact.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params || !template) return template ?? '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
}

/**
 * Resolve a translation key against catalogs.
 * Order: active locale → Spanish fallback → key itself.
 */
export function t(
  catalogs: UiCatalogMap | null | undefined,
  locale: string | null | undefined,
  key: string,
  params?: Record<string, string | number>,
  fallbackLocale: UiLocale = DEFAULT_UI_LOCALE,
): string {
  if (!key) return '';
  const loc = resolveUiLocale(locale, fallbackLocale);
  const primary = catalogs?.[loc];
  const fallback = catalogs?.[fallbackLocale];
  const raw =
    (primary && primary[key]) ||
    (fallback && fallback[key]) ||
    key;
  return interpolate(raw, params);
}

/** Human labels for the UI language picker (native names). */
export function uiLocaleLabel(locale: string | null | undefined): string {
  const loc = resolveUiLocale(locale);
  const map: Record<UiLocale, string> = {
    es: 'Español',
    en: 'English',
    zh: '中文',
    hi: 'हिन्दी',
    ar: 'العربية',
  };
  return map[loc];
}

/** Pref value: concrete corpus locale or follow the device. */
export type ContentLocalePref = 'system' | string;

export interface StoredLocalePrefs {
  contentLocale: ContentLocalePref;
  uiLocale: UiLocale;
}

function clampContentLocale(raw: unknown): ContentLocalePref {
  const rawLoc = (raw ?? 'system').toString().trim();
  if (!rawLoc || rawLoc === 'system') return 'system';
  return rawLoc.toLowerCase().split(/[-_]/)[0] || 'system';
}

/**
 * Locale fields for `reader.prefs.v1`.
 *
 * - No JSON / empty: first launch — UI from device, content `system`.
 * - Saved JSON: stored values win (independent UI vs content).
 * - Old blobs missing `uiLocale`: keep Spanish (do not surprise existing installs).
 * - Invalid JSON: same as first launch.
 */
export function localePrefsFromStorage(
  raw: string | null | undefined,
  navigatorLanguage?: string | null,
): StoredLocalePrefs {
  if (raw == null || raw === '') {
    return {
      contentLocale: 'system',
      uiLocale: defaultUiLocaleFromDevice(navigatorLanguage),
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      contentLocale?: unknown;
      uiLocale?: unknown;
    };
    const hasUi =
      parsed != null &&
      parsed.uiLocale != null &&
      String(parsed.uiLocale).trim() !== '';
    return {
      contentLocale: clampContentLocale(parsed?.contentLocale),
      uiLocale: hasUi
        ? resolveUiLocale(String(parsed.uiLocale))
        : DEFAULT_UI_LOCALE,
    };
  } catch {
    return {
      contentLocale: 'system',
      uiLocale: defaultUiLocaleFromDevice(navigatorLanguage),
    };
  }
}
