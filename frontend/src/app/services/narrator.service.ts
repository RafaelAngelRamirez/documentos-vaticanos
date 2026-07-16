import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { environment } from 'src/environments/environment';
import {
  NarratorVoice,
  buildGrokSpeakBody,
  grokSpeakUrl,
  grokVoicesUrl,
  isGrokVoice,
  mergeNarratorVoices,
  parseGrokVoicesResponse,
  planGrokRate,
} from './narrator-grok.logic';
import { NarratorPreferencesService } from './narrator-preferences.service';

export type { NarratorVoice } from './narrator-grok.logic';
export {
  isGrokVoice,
  grokVoiceIdOf,
  narrVoicePillLabel,
} from './narrator-grok.logic';

/**
 * 5D · Narrador — abstracción sobre el backend de síntesis de voz.
 *
 * - Web/desktop: Web Speech API (`window.speechSynthesis`).
 * - APK (Capacitor): plugin nativo `@capacitor-community/text-to-speech`
 *   (el WebView de Android no implementa la Web Speech API).
 * - Online (opcional): voces Grok vía proxy backend `POST /api/v1/tts/speak`
 *   (clave XAI solo en servidor; SuperGrok no aplica). Offline o sin
 *   configuración → solo voces del sistema.
 *
 * Selección de voz:
 * - Web: se asigna `SpeechSynthesisUtterance.voice` directamente.
 * - Nativo: se pasa `voice` (índice) y `lang` de la voz elegida; si el
 *   motor ignora el índice, el cambio de `lang` aplica al menos el acento.
 * - Grok: descarga audio del proxy y reproduce con `HTMLAudioElement`.
 */
@Injectable({ providedIn: 'root' })
export class NarratorService {
  private readonly native = Capacitor.isNativePlatform();

  /** Generación de habla; invalida promesas pendientes al cancelar. */
  private generation = 0;

  /** Reproducción Grok en curso (blob URL + elemento audio). */
  private grokAudio: HTMLAudioElement | null = null;
  private grokObjectUrl: string | null = null;

  constructor(private narrPrefs: NarratorPreferencesService) {}

  get supported(): boolean {
    return (
      this.native ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window)
    );
  }

  /**
   * Voces disponibles para el idioma indicado (prefijo BCP-47).
   * Incluye voces Grok al final si el proxy reporta `available: true`.
   */
  async listVoices(prefix = 'es'): Promise<NarratorVoice[]> {
    if (!this.supported) return [];
    const p = prefix.toLowerCase();

    let system: NarratorVoice[] = [];

    if (this.native) {
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        system = (voices ?? [])
          .map((v, index) => ({
            id: v.voiceURI || `${v.lang}#${index}`,
            name: v.name || v.lang,
            lang: v.lang,
            index,
            provider: 'system' as const,
          }))
          .filter((v) => (v.lang ?? '').toLowerCase().startsWith(p));
      } catch {
        system = [];
      }
    } else {
      const all = await this.webVoices();
      system = all
        .map((v, index) => ({
          id: v.voiceURI || `${v.lang}#${index}`,
          name: v.name || v.lang,
          lang: v.lang,
          index,
          provider: 'system' as const,
        }))
        .filter((v) => (v.lang ?? '').toLowerCase().startsWith(p));
    }

    // Preferencia por dispositivo (Ajustes): si Grok está off, solo sistema.
    const grok = this.narrPrefs.grokEnabled
      ? await this.fetchGrokVoices()
      : [];
    return mergeNarratorVoices(system, grok);
  }

  /**
   * Estado del proxy Grok para la UI de Ajustes (no muta preferencias).
   * Respeta offline-first: errores → offline / unavailable.
   */
  async probeGrokStatus(): Promise<{
    status: 'available' | 'unavailable' | 'offline' | 'disabled';
    voiceCount: number;
  }> {
    if (!this.narrPrefs.grokEnabled) {
      return { status: 'disabled', voiceCount: 0 };
    }
    const base = environment.apiBaseUrl;
    if (!base || typeof fetch === 'undefined') {
      return { status: 'offline', voiceCount: 0 };
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(grokVoicesUrl(base), {
        method: 'GET',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        return { status: 'offline', voiceCount: 0 };
      }
      const data = await res.json();
      const voices = parseGrokVoicesResponse(data, 'es-ES');
      if (data?.available === true) {
        return { status: 'available', voiceCount: voices.length };
      }
      return { status: 'unavailable', voiceCount: 0 };
    } catch {
      return { status: 'offline', voiceCount: 0 };
    }
  }

  /** Consulta el proxy; falla en silencio (offline-first). */
  private async fetchGrokVoices(): Promise<NarratorVoice[]> {
    const base = environment.apiBaseUrl;
    if (!base || typeof fetch === 'undefined') return [];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(grokVoicesUrl(base), {
        method: 'GET',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return [];
      const data = await res.json();
      return parseGrokVoicesResponse(data, 'es-ES');
    } catch {
      return [];
    }
  }

  /** `speechSynthesis.getVoices()` con espera de `voiceschanged` (carga lazy en Chrome). */
  private webVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return Promise.resolve(now);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(synth.getVoices());
      };
      synth.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, 1500);
    });
  }

  /**
   * Lee un texto en voz alta.
   * Resuelve `true` si la locución terminó de forma natural y
   * `false` si fue cancelada o falló (el llamador no debe encadenar).
   */
  async speak(
    text: string,
    opts: { lang?: string; rate?: number; voice?: NarratorVoice | null } = {}
  ): Promise<boolean> {
    if (!this.supported || !text) return false;
    const lang = opts.voice?.lang ?? opts.lang ?? 'es-ES';
    const rate = opts.rate ?? 1;
    const gen = ++this.generation;

    // Detener cualquier reproducción previa (sistema o Grok).
    await this.stopPlaybackEngines();

    // Grok solo si está activo en este dispositivo y la voz es Grok.
    if (isGrokVoice(opts.voice) && this.narrPrefs.grokEnabled) {
      return this.speakGrok(text, { lang, rate, voice: opts.voice!, gen });
    }

    if (this.native) {
      try {
        await TextToSpeech.stop().catch(() => undefined);
        await TextToSpeech.speak({
          text,
          lang,
          rate,
          pitch: 1,
          volume: 1,
          category: 'playback',
          // Índice según getSupportedVoices(); si el motor lo ignora,
          // `lang` ya aplica el acento de la voz elegida.
          ...(opts.voice && opts.voice.index >= 0
            ? { voice: opts.voice.index }
            : {}),
        });
        return gen === this.generation;
      } catch {
        return false;
      }
    }

    return new Promise<boolean>((resolve) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      if (opts.voice) {
        const match = window.speechSynthesis
          .getVoices()
          .find((v) => v.voiceURI === opts.voice!.id);
        if (match) u.voice = match;
      }
      u.onend = () => resolve(gen === this.generation);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    });
  }

  /**
   * Sintetiza vía proxy backend y reproduce el audio.
   * Si no hay red/API/clave, resuelve false (el lector no se bloquea).
   */
  private async speakGrok(
    text: string,
    opts: {
      lang: string;
      rate: number;
      voice: NarratorVoice;
      gen: number;
    }
  ): Promise<boolean> {
    const base = environment.apiBaseUrl;
    if (!base || typeof fetch === 'undefined') return false;
    if (typeof Audio === 'undefined') return false;

    try {
      const body = buildGrokSpeakBody({
        text,
        voice: opts.voice,
        language: opts.lang,
        rate: opts.rate,
      });
      const res = await fetch(grokSpeakUrl(base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (opts.gen !== this.generation) return false;
      if (!res.ok) return false;
      const blob = await res.blob();
      if (opts.gen !== this.generation) return false;
      if (!blob || blob.size === 0) return false;

      this.revokeGrokUrl();
      const url = URL.createObjectURL(blob);
      this.grokObjectUrl = url;
      const audio = new Audio(url);
      this.grokAudio = audio;
      // Rate solo en body.speed (buildGrokSpeakBody); playbackRate queda 1.
      const { playbackRate } = planGrokRate(opts.rate);
      try {
        audio.playbackRate = playbackRate;
      } catch {
        /* ignore */
      }

      return await new Promise<boolean>((resolve) => {
        const finish = (ok: boolean) => {
          if (this.grokAudio === audio) {
            this.grokAudio = null;
          }
          this.revokeGrokUrl();
          resolve(ok && opts.gen === this.generation);
        };
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        void audio.play().catch(() => finish(false));
      });
    } catch {
      return false;
    }
  }

  private revokeGrokUrl(): void {
    if (this.grokObjectUrl) {
      try {
        URL.revokeObjectURL(this.grokObjectUrl);
      } catch {
        /* ignore */
      }
      this.grokObjectUrl = null;
    }
  }

  /** Para motores de audio sin invalidar generation (uso interno pre-speak). */
  private async stopPlaybackEngines(): Promise<void> {
    if (this.grokAudio) {
      try {
        this.grokAudio.pause();
        this.grokAudio.src = '';
      } catch {
        /* ignore */
      }
      this.grokAudio = null;
    }
    this.revokeGrokUrl();
    if (this.native) {
      await TextToSpeech.stop().catch(() => undefined);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /** Detiene cualquier locución en curso. */
  async cancel(): Promise<void> {
    this.generation++;
    await this.stopPlaybackEngines();
  }
}
