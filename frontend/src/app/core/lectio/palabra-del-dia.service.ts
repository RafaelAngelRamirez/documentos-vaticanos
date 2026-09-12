import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  PalabraDelDia,
  parsePalabraDelDiaRss,
  palabraRssUrlForLocale,
} from './palabra-del-dia.parse';

export const PALABRA_CACHE_KEY = 'dv.lectio.cache.v1';

/**
 * Optional Vatican News «Palabra del día» (readings + papal words).
 * Native: CapacitorHttp (no CORS). Web: fetch, likely CORS-blocked → cache only.
 * Never blocks the reader.
 */
@Injectable({ providedIn: 'root' })
export class PalabraDelDiaService {
  loadCached(): PalabraDelDia | null {
    try {
      const raw = localStorage.getItem(PALABRA_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PalabraDelDia;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  persist(row: PalabraDelDia): void {
    try {
      localStorage.setItem(PALABRA_CACHE_KEY, JSON.stringify(row));
    } catch {
      /* quota */
    }
  }

  async refresh(
    locale: string,
    dateIso?: string | null,
  ): Promise<PalabraDelDia | null> {
    const url = palabraRssUrlForLocale(locale);
    try {
      const xml = await this.getText(url);
      const parsed = parsePalabraDelDiaRss(xml, dateIso);
      if (parsed) this.persist(parsed);
      return parsed || this.loadCached();
    } catch {
      return this.loadCached();
    }
  }

  private async getText(url: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({
        url,
        readTimeout: 15000,
        responseType: 'text',
      });
      const data = res.data;
      return typeof data === 'string' ? data : JSON.stringify(data ?? '');
    }
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) {
      throw new Error(`palabra-del-dia HTTP ${res.status}`);
    }
    return res.text();
  }
}
