import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  applyDocumentLangDir,
  DEFAULT_UI_LOCALE,
  dirForLocale,
  resolveUiLocale,
  t as tPure,
  UiCatalogMap,
  UiLocale,
  UI_LOCALES,
  uiLocaleLabel,
} from './ui-i18n.logic';
import { ReaderPreferencesService } from '../../services/reader-preferences.service';

import es from '../../../assets/i18n/es.json';
import en from '../../../assets/i18n/en.json';
import zh from '../../../assets/i18n/zh.json';
import hi from '../../../assets/i18n/hi.json';
import ar from '../../../assets/i18n/ar.json';

/** Bundled offline catalogs (also served from `assets/i18n/`). */
const BUNDLED: UiCatalogMap = {
  es: es as Record<string, string>,
  en: en as Record<string, string>,
  zh: zh as Record<string, string>,
  hi: hi as Record<string, string>,
  ar: ar as Record<string, string>,
};

/**
 * UI strings i18n (menus, chrome). Content language of the corpus is separate
 * (`contentLocale` on ReaderPreferencesService).
 */
@Injectable({ providedIn: 'root' })
export class UiI18nService {
  readonly locales = UI_LOCALES;

  private readonly catalogs: UiCatalogMap = { ...BUNDLED };

  private readonly localeSubject = new BehaviorSubject<UiLocale>(
    DEFAULT_UI_LOCALE,
  );

  /** Active UI locale (drives re-render when components subscribe). */
  readonly locale$ = this.localeSubject.asObservable();

  constructor(private readonly readerPrefs: ReaderPreferencesService) {
    const initial = resolveUiLocale(this.readerPrefs.snapshot.uiLocale);
    this.localeSubject.next(initial);
    this.applyDom(initial);

    this.readerPrefs.prefs$.subscribe((prefs) => {
      const next = resolveUiLocale(prefs.uiLocale);
      if (next !== this.localeSubject.value) {
        this.localeSubject.next(next);
        this.applyDom(next);
      }
    });
  }

  get locale(): UiLocale {
    return this.localeSubject.value;
  }

  get dir(): 'rtl' | 'ltr' {
    return dirForLocale(this.locale);
  }

  /** Persist UI locale (also updates `lang`/`dir` via prefs subscription). */
  setLocale(locale: string): void {
    const next = resolveUiLocale(locale);
    this.readerPrefs.setUiLocale(next);
  }

  /**
   * Translate a catalog key.
   * Falls back to Spanish, then to the key itself.
   */
  t(key: string, params?: Record<string, string | number>): string {
    return tPure(this.catalogs, this.locale, key, params);
  }

  /** Native label for a UI locale code (for pickers). */
  localeLabel(code: string): string {
    return uiLocaleLabel(code);
  }

  private applyDom(locale: UiLocale): void {
    if (typeof document === 'undefined') return;
    applyDocumentLangDir(document.documentElement, locale);
  }
}
