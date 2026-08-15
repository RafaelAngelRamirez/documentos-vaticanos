export const NARRATOR_PREFS_STORAGE_KEY = 'dv.narr.prefs.v1';

export interface NarratorDevicePrefs {
  grokEnabled: boolean;
  voiceId: string | null;
  xaiApiKey: string | null;
  readCitationPrefix: boolean;
  narrRate: number;
}

export const DEFAULT_NARRATOR_PREFS: NarratorDevicePrefs = {
  grokEnabled: false,
  voiceId: null,
  xaiApiKey: null,
  readCitationPrefix: true,
  narrRate: 1,
};

export function parseNarratorPrefs(raw: unknown): NarratorDevicePrefs {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rate = Number(src['narrRate']);
  return {
    grokEnabled: src['grokEnabled'] === true,
    voiceId: typeof src['voiceId'] === 'string' ? src['voiceId'] : null,
    xaiApiKey: typeof src['xaiApiKey'] === 'string' ? src['xaiApiKey'] : null,
    readCitationPrefix: src['readCitationPrefix'] !== false,
    narrRate: Number.isFinite(rate) && rate >= 0.5 && rate <= 2 ? rate : 1,
  };
}

export function loadNarratorPrefs(
  storage: { getItem(k: string): string | null } | null | undefined
): NarratorDevicePrefs {
  try {
    const raw = storage?.getItem(NARRATOR_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NARRATOR_PREFS };
    return parseNarratorPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_NARRATOR_PREFS };
  }
}

export function saveNarratorPrefs(
  storage: { setItem(k: string, v: string): void } | null | undefined,
  prefs: NarratorDevicePrefs
): void {
  try {
    storage?.setItem(NARRATOR_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

export function narratorPrefsForBackup(
  prefs: Partial<NarratorDevicePrefs> | null | undefined
): Omit<NarratorDevicePrefs, 'xaiApiKey'> | null {
  if (!prefs) return null;
  const parsed = parseNarratorPrefs(prefs);
  return {
    grokEnabled: parsed.grokEnabled,
    voiceId: parsed.voiceId,
    readCitationPrefix: parsed.readCitationPrefix,
    narrRate: parsed.narrRate,
  };
}

export function resolvePreferredVoice<T extends { id: string }>(
  voices: T[],
  voiceId: string | null | undefined
): T | null {
  if (!voices.length) return null;
  if (voiceId) {
    const found = voices.find((v) => v.id === voiceId);
    if (found) return found;
  }
  return voices[0];
}

export const NARRATOR_RATES = [0.75, 1, 1.25, 1.5];

export function cycleRate(current: number): number {
  const i = NARRATOR_RATES.indexOf(current);
  return NARRATOR_RATES[(i + 1) % NARRATOR_RATES.length];
}
