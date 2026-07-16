import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_NARRATOR_DEVICE_PREFS,
  NARRATOR_PREFS_STORAGE_KEY,
  NARRATOR_VOICE_LEGACY_KEY,
  NarratorDevicePrefs,
  parseNarratorDevicePrefs,
  serializeNarratorDevicePrefs,
  shouldFetchGrokVoices,
} from './narrator-prefs.logic';

export type { NarratorDevicePrefs } from './narrator-prefs.logic';
export {
  NARRATOR_PREFS_STORAGE_KEY,
  NARRATOR_VOICE_LEGACY_KEY,
  shouldFetchGrokVoices,
  grokStatusLabel,
} from './narrator-prefs.logic';
export type { GrokServerStatus } from './narrator-prefs.logic';

/**
 * Preferencias del narrador **por dispositivo** (localStorage).
 * Independientes de la cuenta: no requieren login ni SuperGrok.
 * La clave XAI vive solo en el backend del despliegue.
 */
@Injectable({ providedIn: 'root' })
export class NarratorPreferencesService {
  private readonly subject = new BehaviorSubject<NarratorDevicePrefs>(
    this.load()
  );

  readonly prefs$ = this.subject.asObservable();

  get snapshot(): NarratorDevicePrefs {
    return this.subject.value;
  }

  /** Si este equipo debe intentar listar/usar voces Grok. */
  get grokEnabled(): boolean {
    return shouldFetchGrokVoices(this.subject.value);
  }

  get voiceId(): string | null {
    return this.subject.value.voiceId;
  }

  update(partial: Partial<NarratorDevicePrefs>): void {
    const next: NarratorDevicePrefs = {
      ...this.subject.value,
      ...partial,
    };
    if (partial.voiceId !== undefined) {
      next.voiceId =
        partial.voiceId == null || partial.voiceId === ''
          ? null
          : String(partial.voiceId);
    }
    this.subject.next(next);
    this.persist(next);
  }

  setGrokEnabled(enabled: boolean): void {
    this.update({ grokEnabled: enabled });
  }

  setVoiceId(voiceId: string | null): void {
    this.update({ voiceId });
  }

  toggleGrokEnabled(): void {
    this.setGrokEnabled(!this.subject.value.grokEnabled);
  }

  private load(): NarratorDevicePrefs {
    let raw: string | null = null;
    let legacy: string | null = null;
    try {
      raw = localStorage.getItem(NARRATOR_PREFS_STORAGE_KEY);
      legacy = localStorage.getItem(NARRATOR_VOICE_LEGACY_KEY);
    } catch {
      return { ...DEFAULT_NARRATOR_DEVICE_PREFS };
    }
    const prefs = parseNarratorDevicePrefs(raw, legacy);
    // Si migró desde legado y no había v1, persistir unificado.
    if (!raw && legacy && prefs.voiceId) {
      this.persist(prefs);
    }
    return prefs;
  }

  private persist(prefs: NarratorDevicePrefs): void {
    try {
      localStorage.setItem(
        NARRATOR_PREFS_STORAGE_KEY,
        serializeNarratorDevicePrefs(prefs)
      );
      // Mantener clave legada alineada (lector antiguo / backup parcial).
      if (prefs.voiceId) {
        localStorage.setItem(NARRATOR_VOICE_LEGACY_KEY, prefs.voiceId);
      } else {
        localStorage.removeItem(NARRATOR_VOICE_LEGACY_KEY);
      }
    } catch {
      /* storage no disponible */
    }
  }
}
