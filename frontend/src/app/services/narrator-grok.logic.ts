/**
 * Lógica pura del narrador multi-provider (sistema + Grok TTS).
 * Sin Angular ni DOM — testeable con Node `--experimental-strip-types`.
 *
 * Grok/xAI TTS: el cliente llama a api.x.ai con la API key guardada **solo
 * en el dispositivo** (Ajustes). SuperGrok no es un proveedor de TTS aquí.
 */

/** Base pública del TTS xAI (cliente → api.x.ai; key en el dispositivo). */
export const XAI_TTS_DEFAULT_BASE = 'https://api.x.ai/v1';

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

/**
 * Interpreta respuesta de voces:
 * - xAI directo: `{ voices: [...] }`
 * - proxy legado: `{ available: true, voices: [...] }`
 */
export function parseGrokVoicesResponse(
  data: GrokVoicesResponse | null | undefined,
  lang = 'es-ES'
): NarratorVoice[] {
  if (!data) return [];
  // Proxy: solo si available === true
  if (data.available === false) return [];
  if (data.available === true) return mapGrokApiVoices(data.voices, lang);
  // xAI directo (sin campo available)
  if (Array.isArray(data.voices)) return mapGrokApiVoices(data.voices, lang);
  return [];
}

/** URL listado voces en api.x.ai (cliente → xAI directo). */
export function xaiTtsVoicesUrl(base = XAI_TTS_DEFAULT_BASE): string {
  return `${String(base || XAI_TTS_DEFAULT_BASE).replace(/\/$/, '')}/tts/voices`;
}

/** URL síntesis en api.x.ai. */
export function xaiTtsSpeakUrl(base = XAI_TTS_DEFAULT_BASE): string {
  return `${String(base || XAI_TTS_DEFAULT_BASE).replace(/\/$/, '')}/tts`;
}

/** Headers de auth para la key del dispositivo. */
export function xaiAuthHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${String(apiKey).trim()}`,
  };
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

/**
 * Plan de velocidad Grok: el rate del narrador se envía solo a la API
 * (`speed`). El elemento `<audio>` debe quedar en playbackRate=1 para no
 * duplicar (p. ej. 1.25× API × 1.25 local ≈ 1.56×).
 */
export function planGrokRate(rate?: number): {
  apiSpeed: number | undefined;
  playbackRate: number;
} {
  if (rate != null && Number.isFinite(rate)) {
    return { apiSpeed: Number(rate), playbackRate: 1 };
  }
  return { apiSpeed: undefined, playbackRate: 1 };
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
  const { apiSpeed } = planGrokRate(opts.rate);
  const body: Record<string, unknown> = {
    text: String(opts.text ?? '').trim(),
    voice_id: voiceId,
    language,
  };
  if (apiSpeed != null) {
    body['speed'] = apiSpeed;
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
