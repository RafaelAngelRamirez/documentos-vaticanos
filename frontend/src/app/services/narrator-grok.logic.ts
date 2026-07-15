/**
 * Lógica pura del narrador multi-provider (sistema + Grok TTS).
 * Sin Angular ni DOM — testeable con Node `--experimental-strip-types`.
 *
 * Grok/xAI TTS se usa solo online vía proxy del backend; la API key
 * nunca viaja al cliente. SuperGrok no es un proveedor de TTS aquí.
 */

/** Voz unificada del narrador (sistema Web Speech / Capacitor o Grok). */
export interface NarratorVoice {
  /** Identificador estable (`voiceURI` o `grok:<voice_id>`). */
  id: string;
  /** Nombre legible. */
  name: string;
  /** Etiqueta BCP-47 (es-ES, es-MX…). */
  lang: string;
  /** Índice nativo del motor de sistema; -1 si es Grok. */
  index: number;
  /** Proveedor de síntesis. Por defecto `system`. */
  provider?: 'system' | 'grok';
  /** voice_id de xAI cuando provider === 'grok'. */
  grokVoiceId?: string;
}

export type GrokApiVoice = {
  voice_id: string;
  name?: string;
};

export type GrokVoicesResponse = {
  available?: boolean;
  voices?: GrokApiVoice[];
  reason?: string;
  error?: string;
};

export const GROK_VOICE_ID_PREFIX = 'grok:';

/** True si la voz se sintetiza vía proxy Grok (no Web Speech). */
export function isGrokVoice(v: NarratorVoice | null | undefined): boolean {
  if (!v) return false;
  if (v.provider === 'grok') return true;
  return typeof v.id === 'string' && v.id.startsWith(GROK_VOICE_ID_PREFIX);
}

/** Extrae el voice_id xAI desde una voz Grok. */
export function grokVoiceIdOf(v: NarratorVoice | null | undefined): string | null {
  if (!v) return null;
  if (v.grokVoiceId) return v.grokVoiceId;
  if (typeof v.id === 'string' && v.id.startsWith(GROK_VOICE_ID_PREFIX)) {
    return v.id.slice(GROK_VOICE_ID_PREFIX.length) || null;
  }
  return null;
}

/**
 * Mapea voces del proxy GET /tts/voices a NarratorVoice.
 * `lang` por defecto es-ES (unidades del corpus en español).
 */
export function mapGrokApiVoices(
  apiVoices: GrokApiVoice[] | null | undefined,
  lang = 'es-ES'
): NarratorVoice[] {
  if (!Array.isArray(apiVoices) || !apiVoices.length) return [];
  return apiVoices
    .filter((v) => v && typeof v.voice_id === 'string' && v.voice_id.trim())
    .map((v, i) => {
      const vid = v.voice_id.trim();
      const label = (v.name && String(v.name).trim()) || vid;
      return {
        id: `${GROK_VOICE_ID_PREFIX}${vid}`,
        name: label.toLowerCase().startsWith('grok')
          ? label
          : `Grok · ${label}`,
        lang,
        index: -1 - i,
        provider: 'grok' as const,
        grokVoiceId: vid,
      };
    });
}

/** Interpreta la respuesta del proxy; vacío si no disponible. */
export function parseGrokVoicesResponse(
  data: GrokVoicesResponse | null | undefined,
  lang = 'es-ES'
): NarratorVoice[] {
  if (!data || data.available !== true) return [];
  return mapGrokApiVoices(data.voices, lang);
}

/** Une voces del sistema y Grok (sistema primero). */
export function mergeNarratorVoices(
  system: NarratorVoice[],
  grok: NarratorVoice[]
): NarratorVoice[] {
  const sys = Array.isArray(system) ? system : [];
  const gk = Array.isArray(grok) ? grok : [];
  return [...sys, ...gk];
}

/** URL del listado de voces Grok en el backend. */
export function grokVoicesUrl(apiBaseUrl: string): string {
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  return `${base}/tts/voices`;
}

/** URL de síntesis Grok en el backend. */
export function grokSpeakUrl(apiBaseUrl: string): string {
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  return `${base}/tts/speak`;
}

/** Cuerpo JSON del POST /tts/speak del proxy (cliente). */
export function buildGrokSpeakBody(opts: {
  text: string;
  voice: NarratorVoice | null | undefined;
  language?: string;
  rate?: number;
}): Record<string, unknown> {
  const voiceId = grokVoiceIdOf(opts.voice) || 'eve';
  const language =
    opts.language ||
    opts.voice?.lang ||
    'es-ES';
  const body: Record<string, unknown> = {
    text: String(opts.text ?? '').trim(),
    voice_id: voiceId,
    language,
  };
  if (opts.rate != null && Number.isFinite(opts.rate)) {
    body.speed = opts.rate;
  }
  return body;
}

/** Etiqueta corta de pastilla UI: Grok o lang del sistema. */
export function narrVoicePillLabel(
  voice: NarratorVoice | null | undefined,
  all: NarratorVoice[]
): string {
  if (!voice) return 'Voz';
  if (isGrokVoice(voice)) {
    const id = grokVoiceIdOf(voice) || 'Grok';
    return `Grok · ${id}`;
  }
  const sameLang = (all || []).filter(
    (x) => x.lang === voice.lang && !isGrokVoice(x)
  );
  if (sameLang.length < 2) return voice.lang;
  return `${voice.lang} ${sameLang.findIndex((x) => x.id === voice.id) + 1}`;
}
