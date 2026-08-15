import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { localeToBcp47 } from './speech-prep.logic';
import { NarratorPreferencesService } from './narrator-preferences.service';

export interface NarratorVoice {
  id: string;
  name: string;
  lang: string;
  index?: number;
  provider: 'system' | 'grok';
}

export function narrVoicePillLabel(
  voice: NarratorVoice | null,
  voices: NarratorVoice[]
): string {
  if (!voice) return 'Voz';
  if (voice.provider === 'grok') return 'Grok';
  const short = (voice.name || voice.lang || 'Voz').split(' ')[0];
  return voices.length > 1 ? short : 'Voz';
}

export function isGrokVoice(voice: NarratorVoice | null | undefined): boolean {
  return voice?.provider === 'grok' || (voice?.id || '').startsWith('grok:');
}

/**
 * Narrador — Web Speech API + optional xAI TTS (device key).
 * Offline-first: without key or network, only system voices.
 */
@Injectable({ providedIn: 'root' })
export class NarratorService {
  private generation = 0;
  private grokAudio: HTMLAudioElement | null = null;
  private grokObjectUrl: string | null = null;
  private paused = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private readonly fallbackNotice = new Subject<string>();
  readonly fallbackNotice$ = this.fallbackNotice.asObservable();

  constructor(private narrPrefs: NarratorPreferencesService) {}

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  async listVoices(prefix = 'es'): Promise<NarratorVoice[]> {
    if (!this.supported) return [];
    const p = prefix.toLowerCase();
    const all = await this.webVoices();
    const system = all
      .map((v, index) => ({
        id: v.voiceURI || `${v.lang}#${index}`,
        name: v.name || v.lang,
        lang: v.lang,
        index,
        provider: 'system' as const,
      }))
      .filter((v) => (v.lang || '').toLowerCase().startsWith(p));
    const grok = this.narrPrefs.grokEnabled ? await this.fetchGrokVoices() : [];
    return [...system, ...grok];
  }

  async speak(
    text: string,
    opts: {
      lang?: string;
      rate?: number;
      voice?: NarratorVoice | null;
      onEnd?: (finished: boolean) => void;
    }
  ): Promise<boolean> {
    const gen = ++this.generation;
    this.paused = false;
    await this.cancelInternal(false);
    if (!text.trim()) {
      opts.onEnd?.(true);
      return true;
    }

    if (isGrokVoice(opts.voice) && this.narrPrefs.xaiApiKey) {
      const ok = await this.speakGrok(text, opts, gen);
      if (ok) return true;
      this.fallbackNotice.next('Voces del sistema');
    }

    return this.speakWeb(text, opts, gen);
  }

  pause(): boolean {
    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.pause();
      this.paused = true;
      return true;
    }
    if (this.grokAudio && !this.grokAudio.paused) {
      this.grokAudio.pause();
      this.paused = true;
      return true;
    }
    return false;
  }

  resume(): boolean {
    if (this.paused && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      this.paused = false;
      return true;
    }
    if (this.paused && this.grokAudio) {
      void this.grokAudio.play();
      this.paused = false;
      return true;
    }
    return false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  async cancel(): Promise<void> {
    this.generation += 1;
    this.paused = false;
    await this.cancelInternal(true);
  }

  private async cancelInternal(stopSynth: boolean): Promise<void> {
    if (this.grokAudio) {
      this.grokAudio.pause();
      this.grokAudio = null;
    }
    if (this.grokObjectUrl) {
      URL.revokeObjectURL(this.grokObjectUrl);
      this.grokObjectUrl = null;
    }
    if (stopSynth && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  private speakWeb(
    text: string,
    opts: {
      lang?: string;
      rate?: number;
      voice?: NarratorVoice | null;
      onEnd?: (finished: boolean) => void;
    },
    gen: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.supported) {
        opts.onEnd?.(false);
        resolve(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || localeToBcp47('es');
      u.rate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
      if (opts.voice && opts.voice.provider === 'system') {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => (v.voiceURI || v.name) === opts.voice!.id);
        if (match) u.voice = match;
      }
      u.onend = () => {
        if (gen !== this.generation) {
          resolve(false);
          return;
        }
        opts.onEnd?.(true);
        resolve(true);
      };
      u.onerror = () => {
        if (gen !== this.generation) {
          resolve(false);
          return;
        }
        opts.onEnd?.(false);
        resolve(false);
      };
      this.currentUtterance = u;
      window.speechSynthesis.speak(u);
    });
  }

  private async speakGrok(
    text: string,
    opts: {
      lang?: string;
      rate?: number;
      voice?: NarratorVoice | null;
      onEnd?: (finished: boolean) => void;
    },
    gen: number
  ): Promise<boolean> {
    const key = this.narrPrefs.xaiApiKey;
    if (!key || typeof fetch === 'undefined') return false;
    try {
      const voice = (opts.voice?.id || 'grok:ara').replace(/^grok:/, '');
      const res = await fetch('https://api.x.ai/v1/tts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          language: opts.lang || 'es',
        }),
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (gen !== this.generation) return false;
      const url = URL.createObjectURL(blob);
      this.grokObjectUrl = url;
      const audio = new Audio(url);
      this.grokAudio = audio;
      audio.playbackRate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
      await audio.play();
      return await new Promise((resolve) => {
        audio.onended = () => {
          if (gen !== this.generation) {
            resolve(false);
            return;
          }
          opts.onEnd?.(true);
          resolve(true);
        };
        audio.onerror = () => {
          opts.onEnd?.(false);
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  private async fetchGrokVoices(): Promise<NarratorVoice[]> {
    const key = this.narrPrefs.xaiApiKey;
    if (!key || typeof fetch === 'undefined') return [];
    try {
      const res = await fetch('https://api.x.ai/v1/tts/voices', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { voices?: Array<{ id?: string; name?: string; language?: string }> };
      return (data.voices || []).map((v) => ({
        id: `grok:${v.id || v.name || 'ara'}`,
        name: v.name || v.id || 'Grok',
        lang: v.language || 'es',
        provider: 'grok' as const,
      }));
    } catch {
      return [];
    }
  }

  private webVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const now = window.speechSynthesis.getVoices();
      if (now.length) {
        resolve(now);
        return;
      }
      const handler = () => {
        window.speechSynthesis.onvoiceschanged = null;
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.onvoiceschanged = handler;
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 400);
    });
  }
}
