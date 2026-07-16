/**
 * Preferencias del narrador **por dispositivo** (localStorage).
 * Pure — sin Angular. No incluye claves API (solo el servidor las tiene).
 */

export const NARRATOR_PREFS_STORAGE_KEY = 'dv.narr.prefs.v1';

/** Clave legada solo de voz (lector 5D). Se migra a prefs.voiceId. */
export const NARRATOR_VOICE_LEGACY_KEY = 'dv.narr.voice.v1';

export interface NarratorDevicePrefs {
  /**
   * Si true, este equipo pide voces Grok al proxy cuando hay red y el
   * servidor tiene XAI_API_KEY. Offline / sin clave → solo sistema.
   */
  grokEnabled: boolean;
  /** Id de voz preferida (`voiceURI` o `grok:<id>`). null = default del sistema. */
  voiceId: string | null;
}

export const DEFAULT_NARRATOR_DEVICE_PREFS: NarratorDevicePrefs = {
  grokEnabled: true,
  voiceId: null,
};

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
  });
}

/** ¿Debe listVoices/speak pedir Grok en este equipo? */
export function shouldFetchGrokVoices(
  prefs: Pick<NarratorDevicePrefs, 'grokEnabled'>
): boolean {
  return prefs?.grokEnabled === true;
}

export type GrokServerStatus =
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'offline'
  | 'disabled';

/** Etiqueta de estado para la UI de Ajustes. */
export function grokStatusLabel(status: GrokServerStatus): string {
  switch (status) {
    case 'checking':
      return 'Comprobando servidor…';
    case 'available':
      return 'Disponible en este servidor (API xAI configurada)';
    case 'unavailable':
      return 'No configurado en el servidor (falta XAI_API_KEY)';
    case 'offline':
      return 'Sin red o API inalcanzable';
    case 'disabled':
      return 'Desactivado en este dispositivo';
    default:
      return '';
  }
}
