/**
 * Preferencias del narrador **por dispositivo** (localStorage).
 * Pure — sin Angular.
 *
 * La API key de xAI vive solo en el dispositivo (`xaiApiKey`): no se sube a
 * la cuenta, no va al backup por defecto y no es SuperGrok.
 */

export const NARRATOR_PREFS_STORAGE_KEY = 'dv.narr.prefs.v1';

/** Clave legada solo de voz (lector 5D). Se migra a prefs.voiceId. */
export const NARRATOR_VOICE_LEGACY_KEY = 'dv.narr.voice.v1';

export interface NarratorDevicePrefs {
  /**
   * Si true y hay `xaiApiKey`, este dispositivo lista/reproduce voces Grok
   * llamando a xAI con la clave local. Offline / sin clave → solo sistema.
   */
  grokEnabled: boolean;
  /** Id de voz preferida (`voiceURI` o `grok:<id>`). null = default del sistema. */
  voiceId: string | null;
  /**
   * API key de console.x.ai **solo en este dispositivo**.
   * Vacío/null = Grok no disponible aquí. Nunca sincronizar a la nube.
   */
  xaiApiKey: string | null;
}

export const DEFAULT_NARRATOR_DEVICE_PREFS: NarratorDevicePrefs = {
  grokEnabled: true,
  voiceId: null,
  xaiApiKey: null,
};

/** Normaliza una API key pegada (quita Bearer / espacios). */
export function normalizeXaiApiKey(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  let k = String(raw).trim();
  if (!k) return null;
  if (/^bearer\s+/i.test(k)) {
    k = k.replace(/^bearer\s+/i, '').trim();
  }
  return k || null;
}

/** True si hay clave usable en este dispositivo. */
export function hasXaiApiKey(
  prefs: Pick<NarratorDevicePrefs, 'xaiApiKey'>
): boolean {
  return Boolean(normalizeXaiApiKey(prefs?.xaiApiKey ?? null));
}

/** Parsea JSON guardado + migración de clave legada de voz. */
export function parseNarratorDevicePrefs(
  raw: string | null | undefined,
  legacyVoiceId?: string | null
): NarratorDevicePrefs {
  let base: NarratorDevicePrefs = { ...DEFAULT_NARRATOR_DEVICE_PREFS };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<NarratorDevicePrefs>;
      if (typeof parsed.grokEnabled === 'boolean') {
        base.grokEnabled = parsed.grokEnabled;
      }
      if (parsed.voiceId === null) {
        base.voiceId = null;
      } else if (typeof parsed.voiceId === 'string' && parsed.voiceId.trim()) {
        base.voiceId = parsed.voiceId.trim();
      }
      if (parsed.xaiApiKey === null || parsed.xaiApiKey === '') {
        base.xaiApiKey = null;
      } else if (typeof parsed.xaiApiKey === 'string') {
        base.xaiApiKey = normalizeXaiApiKey(parsed.xaiApiKey);
      }
    } catch {
      /* corrupt → defaults */
    }
  }
  // Migración: si no hay voiceId en v1, tomar clave legada del lector.
  if (
    (base.voiceId == null || base.voiceId === '') &&
    typeof legacyVoiceId === 'string' &&
    legacyVoiceId.trim()
  ) {
    base.voiceId = legacyVoiceId.trim();
  }
  return base;
}

export function serializeNarratorDevicePrefs(
  prefs: NarratorDevicePrefs
): string {
  return JSON.stringify({
    grokEnabled: Boolean(prefs.grokEnabled),
    voiceId:
      prefs.voiceId == null || prefs.voiceId === ''
        ? null
        : String(prefs.voiceId),
    xaiApiKey: normalizeXaiApiKey(prefs.xaiApiKey),
  });
}

/**
 * Copia de prefs para backup: **sin** API key (no filtrar la llave en un
 * JSON que se pueda compartir o subir por error).
 */
export function narratorPrefsForBackup(
  prefs: NarratorDevicePrefs | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!prefs || typeof prefs !== 'object') return null;
  const p = prefs as Partial<NarratorDevicePrefs>;
  return {
    grokEnabled: Boolean(p.grokEnabled),
    voiceId:
      p.voiceId == null || p.voiceId === '' ? null : String(p.voiceId),
    // xaiApiKey omitido a propósito
  };
}

/** ¿Debe listVoices/speak usar Grok en este equipo? Requiere toggle + key. */
export function shouldFetchGrokVoices(
  prefs: Pick<NarratorDevicePrefs, 'grokEnabled' | 'xaiApiKey'>
): boolean {
  return prefs?.grokEnabled === true && hasXaiApiKey(prefs);
}

export type GrokServerStatus =
  | 'checking'
  | 'available'
  | 'no_key'
  | 'invalid'
  | 'offline'
  | 'disabled';

/** Etiqueta de estado para la UI de Ajustes. */
export function grokStatusLabel(status: GrokServerStatus): string {
  switch (status) {
    case 'checking':
      return 'Comprobando…';
    case 'available':
      return 'Clave de este dispositivo válida';
    case 'no_key':
      return 'Falta la API key de xAI en este dispositivo';
    case 'invalid':
      return 'Clave rechazada por xAI (revisa o regenera en console.x.ai)';
    case 'offline':
      return 'Sin red o api.x.ai inalcanzable';
    case 'disabled':
      return 'Voces Grok desactivadas en este dispositivo';
    default:
      return '';
  }
}

/** Máscara para UI (nunca mostrar la key completa). */
export function maskXaiApiKey(key: string | null | undefined): string {
  const k = normalizeXaiApiKey(key);
  if (!k) return '';
  if (k.length <= 8) return '••••••••';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
