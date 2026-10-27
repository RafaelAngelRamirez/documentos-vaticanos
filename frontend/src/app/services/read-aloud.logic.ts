/**
 * Sesión de lectura en voz alta offline.
 * Motor: TTS del dispositivo (Web Speech o plugin nativo). Sin red y sin UI.
 *
 * Grok queda fuera de esta sesión: una voz `grok:` no se pronuncia aquí.
 * La pantalla apagada solo se sostiene en Android (servicio en primer plano).
 */

export const READ_ALOUD_RATES = [0.75, 1, 1.25, 1.5] as const;

export type ReadAloudRate = (typeof READ_ALOUD_RATES)[number];

export type ReadAloudPhase = 'idle' | 'playing' | 'paused';

export const READ_ALOUD_CHECKPOINT_KEY = 'dv.narr.read.v1';

export interface DeviceVoiceRef {
  id: string;
  name?: string;
  lang?: string;
  provider?: string;
}

export interface ReadAloudCheckpoint {
  documentId: string;
  unitIndex: number;
  phase: 'playing' | 'paused';
}

export function normalizeReadAloudRate(rate: unknown): ReadAloudRate {
  const n = typeof rate === 'number' ? rate : Number(rate);
  for (const allowed of READ_ALOUD_RATES) {
    if (n === allowed) return allowed;
  }
  return 1;
}

/** Siguiente peldaño. Un valor fuera de la lista cae en 0.75, como el ciclo del lector. */
export function nextReadAloudRate(rate: number): ReadAloudRate {
  const rates = READ_ALOUD_RATES;
  const i = rates.indexOf(rate as ReadAloudRate);
  return rates[(i + 1) % rates.length];
}

/**
 * Ritmo que se entrega al motor. Los títulos usan `rateScale` (< 1).
 * El producto queda entre 0.5 y 2, el rango que aceptan los motores.
 */
export function utteranceRate(
  userRate: number,
  kind?: string | null,
  rateScale?: number | null,
): number {
  const base = normalizeReadAloudRate(userRate);
  const scale =
    kind === 'heading' && rateScale != null && rateScale > 0 ? rateScale : 1;
  return Math.max(0.5, Math.min(2, base * scale));
}

export function isDeviceVoice(
  voice: { id?: string; provider?: string } | null | undefined,
): boolean {
  if (!voice || typeof voice.id !== 'string' || !voice.id.trim()) return false;
  if (voice.provider === 'grok') return false;
  if (voice.id.startsWith('grok:')) return false;
  return true;
}

export function langPrefixOf(lang: string | null | undefined): string {
  return String(lang || '')
    .split(/[-_]/)[0]
    .toLowerCase();
}

export function deviceVoices<T extends DeviceVoiceRef>(
  voices: readonly T[] | null | undefined,
  langPrefix: string,
): T[] {
  const prefix = (langPrefix || '').toLowerCase();
  return (voices ?? []).filter((voice) => {
    if (!isDeviceVoice(voice)) return false;
    if (!prefix) return true;
    return (voice.lang || '').toLowerCase().startsWith(prefix);
  });
}

/**
 * Voz de dispositivo guardada, si sigue en el catálogo de este idioma.
 * No inventa una voz si la guardada es Grok o ya no está: el motor usa la suya
 * y la preferencia global no se pisa.
 */
export function pickDeviceVoice<T extends DeviceVoiceRef>(
  voices: readonly T[] | null | undefined,
  savedVoiceId: string | null | undefined,
  langPrefix: string,
): T | null {
  if (savedVoiceId == null || savedVoiceId === '') return null;
  const id = String(savedVoiceId).trim();
  if (!id || id.startsWith('grok:')) return null;
  return deviceVoices(voices, langPrefix).find((voice) => voice.id === id) ?? null;
}

/** null = no hay otra voz de dispositivo que ciclar. */
export function cycleDeviceVoice<T extends DeviceVoiceRef>(
  voices: readonly T[] | null | undefined,
  currentId: string | null | undefined,
): T | null {
  const list = (voices ?? []).filter((voice) => isDeviceVoice(voice));
  if (list.length < 2) return null;
  const i =
    currentId != null && currentId !== ''
      ? list.findIndex((voice) => voice.id === currentId)
      : -1;
  return list[(i + 1) % list.length];
}

export function toggleReadAloud(opts: {
  phase: ReadAloudPhase;
  unitIndex: number;
  visibleIndex: number;
}): { action: 'pause' } | { action: 'speak'; fromIndex: number } {
  if (opts.phase === 'playing') return { action: 'pause' };
  if (opts.phase === 'paused') {
    return { action: 'speak', fromIndex: clampIndex(opts.unitIndex) };
  }
  return { action: 'speak', fromIndex: clampIndex(opts.visibleIndex) };
}

export function changeReadAloudRate(opts: {
  phase: ReadAloudPhase;
  rate: number;
  unitIndex: number;
}): { rate: ReadAloudRate; restartFrom: number | null } {
  const rate = nextReadAloudRate(opts.rate);
  return {
    rate,
    restartFrom: opts.phase === 'playing' ? clampIndex(opts.unitIndex) : null,
  };
}

export type SpeakPlan =
  | { action: 'stop' }
  | {
      action: 'speak';
      index: number;
      rate: number;
      /** Desplazar el párrafo a la vista. Falso con la pantalla apagada. */
      follow: boolean;
      /** Servicio en primer plano. Solo Android y solo mientras suena. */
      foreground: boolean;
    };

export function planSpeak(opts: {
  speakableIndex: number | null;
  userRate: number;
  kind?: string | null;
  rateScale?: number | null;
  screenOff: boolean;
  platform: string;
}): SpeakPlan {
  if (opts.speakableIndex == null || !Number.isInteger(opts.speakableIndex)) {
    return { action: 'stop' };
  }
  if (opts.speakableIndex < 0) return { action: 'stop' };
  return {
    action: 'speak',
    index: opts.speakableIndex,
    rate: utteranceRate(opts.userRate, opts.kind, opts.rateScale),
    follow: !opts.screenOff,
    foreground: shouldHoldForeground('playing', opts.platform),
  };
}

export function afterUtterance(opts: {
  phase: ReadAloudPhase;
  unitIndex: number;
  finished: boolean;
  screenOff: boolean;
}): {
  advance: boolean;
  unitIndex: number;
  persist: boolean;
  follow: boolean;
} {
  if (!opts.finished || opts.phase !== 'playing') {
    return {
      advance: false,
      unitIndex: clampIndex(opts.unitIndex),
      persist: false,
      follow: false,
    };
  }
  const unitIndex = clampIndex(opts.unitIndex) + 1;
  return {
    advance: true,
    unitIndex,
    persist: opts.screenOff,
    follow: !opts.screenOff,
  };
}

/** Al volver a primer plano, el párrafo que hay que mostrar. */
export function paragraphToFollowOnShow(opts: {
  phase: ReadAloudPhase;
  unitIndex: number;
  hidden: boolean;
}): number | null {
  if (opts.hidden || opts.phase !== 'playing') return null;
  if (!Number.isInteger(opts.unitIndex) || opts.unitIndex < 0) return null;
  return opts.unitIndex;
}

/** El proceso sigue con la pantalla apagada solo en Android, y solo si está sonando. */
export function shouldHoldForeground(
  phase: ReadAloudPhase,
  platform: string | null | undefined,
): boolean {
  return phase === 'playing' && platform === 'android';
}

export function serializeReadAloudCheckpoint(
  checkpoint: ReadAloudCheckpoint,
): string {
  return JSON.stringify({
    documentId: String(checkpoint.documentId),
    unitIndex: clampIndex(checkpoint.unitIndex),
    phase: checkpoint.phase === 'playing' ? 'playing' : 'paused',
  });
}

/** null si el JSON no es de este documento o está roto. */
export function parseReadAloudCheckpoint(
  raw: string | null | undefined,
  documentId: string,
): ReadAloudCheckpoint | null {
  if (!raw || !documentId) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReadAloudCheckpoint>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.documentId !== documentId) return null;
    if (!Number.isInteger(parsed.unitIndex) || (parsed.unitIndex as number) < 0) {
      return null;
    }
    if (parsed.phase !== 'playing' && parsed.phase !== 'paused') return null;
    return {
      documentId,
      unitIndex: parsed.unitIndex as number,
      phase: parsed.phase,
    };
  } catch {
    return null;
  }
}

function clampIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0) return 0;
  return index;
}
