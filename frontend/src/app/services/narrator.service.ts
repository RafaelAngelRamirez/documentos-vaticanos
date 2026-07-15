import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/** Voz disponible para el narrador, unificada entre plataformas. */
export interface NarratorVoice {
  /** Identificador estable (voiceURI cuando existe). */
  id: string;
  /** Nombre legible reportado por el motor TTS. */
  name: string;
  /** Etiqueta BCP-47 (es-ES, es-US, es-MX…). */
  lang: string;
  /** Índice en la lista nativa del motor (requerido por el plugin). */
  index: number;
}

/**
 * 5D · Narrador — abstracción sobre el backend de síntesis de voz.
 *
 * - Web/desktop: Web Speech API (`window.speechSynthesis`).
 * - APK (Capacitor): plugin nativo `@capacitor-community/text-to-speech`
 *   (el WebView de Android no implementa la Web Speech API).
 *
 * Selección de voz:
 * - Web: se asigna `SpeechSynthesisUtterance.voice` directamente.
 * - Nativo: se pasa `voice` (índice) y `lang` de la voz elegida; si el
 *   motor ignora el índice, el cambio de `lang` aplica al menos el acento.
 */
@Injectable({ providedIn: 'root' })
export class NarratorService {
  private readonly native = Capacitor.isNativePlatform();

  /** Generación de habla; invalida promesas pendientes al cancelar. */
  private generation = 0;

  get supported(): boolean {
    return (
      this.native ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window)
    );
  }

  /**
   * Voces disponibles para el idioma indicado (prefijo BCP-47).
   * Devuelve `[]` si el backend no expone listado.
   */
  async listVoices(prefix = 'es'): Promise<NarratorVoice[]> {
    if (!this.supported) return [];
    const p = prefix.toLowerCase();

    if (this.native) {
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        return (voices ?? [])
          .map((v, index) => ({
            id: v.voiceURI || `${v.lang}#${index}`,
            name: v.name || v.lang,
            lang: v.lang,
            index,
          }))
          .filter((v) => (v.lang ?? '').toLowerCase().startsWith(p));
      } catch {
        return [];
      }
    }

    const all = await this.webVoices();
    return all
      .map((v, index) => ({
        id: v.voiceURI || `${v.lang}#${index}`,
        name: v.name || v.lang,
        lang: v.lang,
        index,
      }))
      .filter((v) => (v.lang ?? '').toLowerCase().startsWith(p));
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
          ...(opts.voice ? { voice: opts.voice.index } : {}),
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

  /** Detiene cualquier locución en curso. */
  async cancel(): Promise<void> {
    this.generation++;
    if (this.native) {
      await TextToSpeech.stop().catch(() => undefined);
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
