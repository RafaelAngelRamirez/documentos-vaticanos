import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_NARRATOR_PREFS,
  loadNarratorPrefs,
  NarratorDevicePrefs,
  saveNarratorPrefs,
} from './narrator-prefs.logic';

export { resolvePreferredVoice } from './narrator-prefs.logic';
export type { NarratorDevicePrefs } from './narrator-prefs.logic';

@Injectable({ providedIn: 'root' })
export class NarratorPreferencesService {
  private readonly prefsSubject = new BehaviorSubject<NarratorDevicePrefs>(
    loadNarratorPrefs(typeof localStorage === 'undefined' ? null : localStorage)
  );

  readonly prefs$ = this.prefsSubject.asObservable();

  get snapshot(): NarratorDevicePrefs {
    return this.prefsSubject.value;
  }

  get grokEnabled(): boolean {
    return this.snapshot.grokEnabled && !!this.snapshot.xaiApiKey;
  }

  get voiceId(): string | null {
    return this.snapshot.voiceId;
  }

  get xaiApiKey(): string | null {
    return this.snapshot.xaiApiKey;
  }

  get narrRate(): number {
    return this.snapshot.narrRate;
  }

  private commit(next: NarratorDevicePrefs): void {
    this.prefsSubject.next(next);
    if (typeof localStorage !== 'undefined') {
      saveNarratorPrefs(localStorage, next);
    }
  }

  update(partial: Partial<NarratorDevicePrefs>): void {
    this.commit({ ...this.snapshot, ...partial });
  }

  setVoiceId(voiceId: string | null): void {
    this.update({ voiceId });
  }

  setNarrRate(narrRate: number): void {
    this.update({ narrRate });
  }

  toggleGrokEnabled(): void {
    this.update({ grokEnabled: !this.snapshot.grokEnabled });
  }

  setXaiApiKey(xaiApiKey: string | null): void {
    this.update({ xaiApiKey });
  }

  clearXaiApiKey(): void {
    this.update({ xaiApiKey: null });
  }

  reset(): void {
    this.commit({ ...DEFAULT_NARRATOR_PREFS });
  }
}
