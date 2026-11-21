/**
 * Catálogo y locución del narrador de dispositivo.
 * Una sola regla para Web Speech y para el TTS de Capacitor.
 * Sin red: si el motor ofrece voces locales, las remotas no entran.
 * Grok no se elige aquí salvo en `planNarratorUtterance`, y solo si la
 * preferencia guardada es Grok y el idioma coincide.
 *
 * Sin imports: este archivo lo ejecuta Node con --experimental-strip-types.
 * El ritmo no se reescala. Web Speech y Android usan 1 como normal.
 * El plugin de iOS ya acerca su escala a esa (`adjustRate`).
 * Los peldaños son los de `READ_ALOUD_RATES` / `normalizeNarratorRate`.
 */

/** Voz tal como la devuelve Web Speech o `getSupportedVoices`. */
export interface DeviceEngineVoice {
  voiceURI?: string | null;
  name?: string | null;
  lang?: string | null;
  localService?: boolean | null;
  /** Posición en la lista del motor, antes de ordenar. */
  index: number;
}

export interface MappedDeviceVoice {
  id: string;
  name: string;
  lang: string;
  index: number;
  provider: 'system' | 'grok';
  local?: boolean;
}

/** BCP-47 con guion. `es_MX` y `ES-mx` quedan `es-MX`. */
export function canonicalSpeechLang(lang: string | null | undefined): string {
  const raw = String(lang ?? '')
    .trim()
    .replace(/_/g, '-');
  if (!raw) return '';
  const parts = raw.split('-').filter(Boolean);
  if (!parts.length) return '';
  const [base, region, ...rest] = parts;
  const head = base.toLowerCase();
  let mid = '';
  if (region) {
    if (region.length === 2) mid = region.toUpperCase();
    else if (region.length === 4) {
      mid = region[0].toUpperCase() + region.slice(1).toLowerCase();
    } else mid = region;
  }
  return [head, mid, ...rest].filter(Boolean).join('-');
}

export function langPrefixOf(lang: string | null | undefined): string {
  return String(lang || '')
    .split(/[-_]/)[0]
    .toLowerCase();
}

function isGrokVoice(
  voice: { id?: string; provider?: string } | null | undefined,
): boolean {
  if (!voice) return false;
  if (voice.provider === 'grok') return true;
  return typeof voice.id === 'string' && voice.id.startsWith('grok:');
}

/** Mismos peldaños que `normalizeNarratorRate`. Fuera de la lista, 1. */
export function deviceSpeechRate(rate: unknown): number {
  if (rate === 0.75 || rate === 1 || rate === 1.25 || rate === 1.5) return rate;
  return 1;
}

/**
 * Id estable en los dos motores. `voiceURI` cuando existe
 * (en Android el plugin pone ahí el nombre del motor).
 * Si no hay URI, nombre + idioma. El índice solo es el último recurso.
 */
export function deviceVoiceId(raw: DeviceEngineVoice): string {
  const uri = String(raw.voiceURI ?? '').trim();
  if (uri) return uri;
  const lang = canonicalSpeechLang(raw.lang) || 'und';
  const name = String(raw.name ?? '').trim();
  if (name) return `name:${name}|${lang}`;
  return `idx:${lang}#${raw.index}`;
}

/**
 * Misma forma para los dos motores.
 * `index` sigue siendo el del motor (Capacitor habla por índice).
 * El orden de la lista es el del ciclo: locales primero, luego idioma y nombre.
 */
export function mapDeviceEngineVoices(
  raws: readonly DeviceEngineVoice[] | null | undefined,
): MappedDeviceVoice[] {
  const voices = (raws ?? []).map((raw, position) => {
    const index = Number.isInteger(raw.index) ? raw.index : position;
    const lang = canonicalSpeechLang(raw.lang) || 'es-ES';
    const name = String(raw.name ?? '').trim() || lang;
    return {
      id: deviceVoiceId({ ...raw, index }),
      name,
      lang,
      index,
      provider: 'system' as const,
      local: raw.localService !== false,
    };
  });
  voices.sort((a, b) => {
    const aLocal = a.local !== false;
    const bLocal = b.local !== false;
    if (aLocal !== bLocal) return aLocal ? -1 : 1;
    return (
      a.lang.localeCompare(b.lang) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    );
  });
  return voices;
}

/**
 * Voces del dispositivo para un idioma.
 * Si hay alguna local, las que exigen red se quedan fuera.
 * Si el motor solo ofrece remotas, se usan: no hay otra voz que instalar.
 */
export function deviceCatalogForPrefix<T extends { id?: string; lang?: string; provider?: string; local?: boolean }>(
  voices: readonly T[] | null | undefined,
  prefix: string,
): T[] {
  const p = langPrefixOf(prefix);
  const matching = (voices ?? []).filter((voice) => {
    if (isGrokVoice(voice)) return false;
    if (!p) return true;
    return (voice.lang || '').toLowerCase().startsWith(p);
  });
  const local = matching.filter((voice) => voice.local !== false);
  return local.length ? local : matching;
}

/** Índice actual de una voz en la lista del motor. null si ya no está. */
export function engineVoiceIndex(
  voices: readonly { id: string; index: number; provider?: string }[] | null | undefined,
  voiceId: string | null | undefined,
): number | null {
  if (voiceId == null || voiceId === '') return null;
  const id = String(voiceId).trim();
  if (!id) return null;
  const match = (voices ?? []).find(
    (voice) => voice.id === id && voice.index >= 0 && !isGrokVoice(voice),
  );
  return match ? match.index : null;
}

function pickDeviceVoice<T extends { id: string; lang?: string; provider?: string }>(
  voices: readonly T[] | null | undefined,
  savedVoiceId: string | null | undefined,
  langPrefix: string,
): T | null {
  if (savedVoiceId == null || savedVoiceId === '') return null;
  const id = String(savedVoiceId).trim();
  if (!id || id.startsWith('grok:')) return null;
  const prefix = langPrefixOf(langPrefix);
  return (
    (voices ?? []).find((voice) => {
      if (isGrokVoice(voice) || voice.id !== id) return false;
      if (!prefix) return true;
      return (voice.lang || '').toLowerCase().startsWith(prefix);
    }) ?? null
  );
}

export function pickSavedDeviceVoice<
  T extends { id: string; lang?: string; provider?: string },
>(
  voices: readonly T[] | null | undefined,
  prefs: {
    voiceId?: string | null;
    voiceByLang?: Record<string, string> | null;
  },
  langPrefix: string,
): T | null {
  const prefix = langPrefixOf(langPrefix);
  const byLang = prefs.voiceByLang?.[prefix];
  const fromLang = pickDeviceVoice(voices, byLang ?? null, prefix);
  if (fromLang) return fromLang;
  return pickDeviceVoice(voices, prefs.voiceId ?? null, prefix);
}

/**
 * Ciclo de la lista que se muestra (dispositivo y, en Ajustes, Grok al final).
 * Una sola voz se confirma. Cero voces no cambian nada.
 */
export function cycleListedVoice<T extends { id: string }>(
  voices: readonly T[] | null | undefined,
  currentId: string | null | undefined,
): T | null {
  const list = (voices ?? []).filter(
    (voice) => voice != null && typeof voice.id === 'string' && voice.id.trim(),
  );
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const i =
    currentId != null && currentId !== ''
      ? list.findIndex((voice) => voice.id === currentId)
      : -1;
  return list[(i + 1) % list.length];
}

function preferredById<T extends { id: string }>(
  voices: readonly T[] | null | undefined,
  savedVoiceId: string | null | undefined,
): T | null {
  if (!voices || voices.length === 0) return null;
  if (savedVoiceId == null || savedVoiceId === '') return null;
  const id = String(savedVoiceId).trim();
  if (!id) return null;
  return voices.find((voice) => voice.id === id) ?? null;
}

/**
 * Lang, ritmo y voz de una frase fuera del lector (lectio, portada, contexto).
 * El lector en voz alta no pasa por aquí: esa sesión no pronuncia Grok.
 * Si la voz guardada es Grok y el idioma coincide, se usa. Si no, la voz
 * de dispositivo de ese idioma. Un catálogo incompleto no inventa otra.
 */
export function planNarratorUtterance<
  T extends { id: string; lang?: string; provider?: string },
>(opts: {
  voices: readonly T[] | null | undefined;
  voiceId?: string | null;
  voiceByLang?: Record<string, string> | null;
  lang: string;
  rate: number;
}): { lang: string; rate: number; voice: T | null } {
  const lang = canonicalSpeechLang(opts.lang) || 'es-ES';
  const prefix = langPrefixOf(lang);
  const rate = deviceSpeechRate(opts.rate);
  const voices = opts.voices ?? [];
  const preferred = preferredById(voices, opts.voiceId ?? null);
  if (
    preferred &&
    isGrokVoice(preferred) &&
    (!prefix || langPrefixOf(preferred.lang) === prefix)
  ) {
    return { lang, rate, voice: preferred };
  }
  const voice = pickSavedDeviceVoice(
    voices,
    { voiceId: opts.voiceId, voiceByLang: opts.voiceByLang },
    prefix,
  );
  return { lang, rate, voice };
}
