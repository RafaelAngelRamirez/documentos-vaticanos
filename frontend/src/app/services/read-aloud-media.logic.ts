/**
 * Sesión de medios de la lectura en voz alta (web).
 *
 * La Web Speech API no es un elemento de medios. Blink, en
 * `speech_synthesis.cc` de la rama main (noviembre 2026), no pausa la
 * locución cuando la página se oculta y tampoco entrega PCM ni
 * MediaStream: la voz del dispositivo no puede ser el `src` de un
 * `<audio>`. La sesión del sistema (título, play, pause, anterior,
 * siguiente) solo se engancha a un HTMLMediaElement. Sin ese elemento,
 * al minimizar o cambiar de app el navegador puede congelar la página
 * y la cadena de párrafos se corta. En iOS la síntesis se suspende
 * igual: la web no puede impedirlo.
 *
 * El WAV de anclaje mantiene la sesión. No es la voz. Si el TTS del
 * sistema se calla con la app oculta, los controles siguen y el
 * párrafo se retoma al volver. La notificación no tiene la línea de
 * tiempo del párrafo.
 */
import type { ReadAloudPhase } from './read-aloud.logic';

export const SPEECH_SYNTHESIS_BACKGROUND = {
  blinkPausesOnHide: false,
  exposesAudioBuffer: false,
  bindsMediaSession: false,
  iosContinuesInBackground: false,
} as const;

export const MEDIA_SESSION_ARTIST = 'Documentos Vaticanos';

export const MEDIA_SESSION_ACTIONS = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
] as const;

export type MediaSessionAction = (typeof MEDIA_SESSION_ACTIONS)[number];

/** 8 s, por encima del mínimo de ~5 s con el que Chrome Android muestra el aviso. */
export const CARRIER_SAMPLE_RATE = 8000;
export const CARRIER_DURATION_SEC = 8;
/** El elemento no va a volumen 0: Chrome trata eso como silencio y no publica la sesión. */
export const CARRIER_ELEMENT_VOLUME = 1;

export interface MediaSessionPlan {
  title: string;
  artist: string;
  playbackState: 'none' | 'paused' | 'playing';
  actions: readonly MediaSessionAction[];
}

export function planMediaSession(opts: {
  phase: ReadAloudPhase;
  title: string | null | undefined;
}): MediaSessionPlan {
  const trimmed = String(opts.title ?? '').trim();
  const playbackState =
    opts.phase === 'playing'
      ? 'playing'
      : opts.phase === 'paused'
        ? 'paused'
        : 'none';
  return {
    title: trimmed || MEDIA_SESSION_ARTIST,
    artist: MEDIA_SESSION_ARTIST,
    playbackState,
    actions: MEDIA_SESSION_ACTIONS,
  };
}

/**
 * Inicio de búsqueda del párrafo anterior o siguiente.
 * null: no hay otro numeral en esa dirección.
 */
export function planTrackStep(opts: {
  direction: 'previous' | 'next';
  unitIndex: number;
  unitCount: number;
}): { fromIndex: number } | null {
  const count = opts.unitCount;
  if (!Number.isInteger(count) || count <= 0) return null;
  let index = opts.unitIndex;
  if (!Number.isInteger(index) || index < 0) index = 0;
  if (index >= count) index = count - 1;
  if (opts.direction === 'next') {
    if (index + 1 >= count) return null;
    return { fromIndex: index + 1 };
  }
  if (index <= 0) return null;
  return { fromIndex: index - 1 };
}

/**
 * PCM 16-bit mono. Las muestras son ±1: no es silencio digital y
 * queda unos 90 dB por debajo del fondo de escala, así que no se oye
 * encima de la voz del sistema.
 */
export function carrierWavBytes(): Uint8Array {
  const numSamples = CARRIER_SAMPLE_RATE * CARRIER_DURATION_SEC;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, CARRIER_SAMPLE_RATE, true);
  view.setUint32(28, CARRIER_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true);
  }
  return new Uint8Array(buffer);
}
