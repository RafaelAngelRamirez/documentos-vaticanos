import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import {
  NarratorVoice,
  buildGrokSpeakBody,
  isGrokVoice,
  mergeNarratorVoices,
  parseGrokVoicesResponse,
  planGrokRate,
  xaiAuthHeaders,
  xaiTtsSpeakUrl,
  xaiTtsVoicesUrl,
} from './narrator-grok.logic';
import {
  canonicalSpeechLang,
  deviceCatalogForPrefix,
  deviceVoiceId,
  engineVoiceIndex,
  mapDeviceEngineVoices,
  planNarratorUtterance,
  type DeviceEngineVoice,
} from './narrator-device.logic';
import { NarratorPreferencesService } from './narrator-preferences.service';
import {
  estimateSpeakCharIndex,
  resumeSpeakText,
  wordStartAt,
} from './narrator-resume.logic';
import type { ReadAloudPhase } from './read-aloud.logic';
import {
  CARRIER_ELEMENT_VOLUME,
  MEDIA_SESSION_ACTIONS,
  type MediaSessionAction,
  carrierWavBytes,
  planMediaSession,
} from './read-aloud-media.logic';

export interface ReadAloudMediaHandlers {
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** Voz, acento o velocidad que se aplican a la locución en curso. */
export interface NarratorSpeakPatch {
  lang?: string;
  rate?: number;
  voice?: NarratorVoice | null;
}

interface LiveSpeak {
  text: string;
  lang: string;
  rate: number;
  voice: NarratorVoice | null;
  gen: number;
  token: number;
  cursor: number;
  heardBoundary: boolean;
  startedAt: number;
  timer: ReturnType<typeof setInterval> | null;
  settled: boolean;
  resolve: (ok: boolean) => void;
}

export type { NarratorVoice } from './narrator-grok.logic';
export {
  isGrokVoice,
  grokVoiceIdOf,
  narrVoicePillLabel,
} from './narrator-grok.logic';

/**
 * 5D · Narrador — abstracción sobre el backend de síntesis de voz.
 *
 * - Web/desktop: Web Speech API (`window.speechSynthesis`). Esa voz no
 *   sigue sola al minimizar: no es un medio. En la web, la lectura en
 *   voz alta ancla un `<audio>` local (WAV inaudible, no es la voz) y
 *   publica título, play, pause, anterior y siguiente. La voz no cambia.
 * - APK (Capacitor): plugin nativo `@capacitor-community/text-to-speech`.
 * - Online (opcional): voces Grok vía **API key del dispositivo**
 *   (`dv.narr.prefs.v1` → xaiApiKey) llamando a `https://api.x.ai/v1/tts`.
 *   La clave no se sube a la nube; sin key o sin red → solo sistema.
 *
 * Selección de voz (los dos motores de dispositivo):
 * el id es `voiceURI` (o nombre + idioma). Al hablar se busca ese id
 * en el catálogo fresco. En la web se asigna esa voz; en Capacitor se
 * pasa el índice que ese id tiene ahora. Una voz que ya no está deja
 * la voz por defecto del idioma, igual en los dos.
 * - Grok: descarga audio de xAI y reproduce con `HTMLAudioElement`.
 *   Sigue siendo opcional y con red.
 *
 * Cambiar voz, acento (`lang`) o velocidad durante la locución no
 * vuelve al inicio: `retune` sigue en la palabra o frase actual.
 */
@Injectable({ providedIn: 'root' })
export class NarratorService {
  private readonly native = Capacitor.isNativePlatform();

  /** Generación de habla; invalida promesas pendientes al cancelar. */
  private generation = 0;

  /** Locución viva. `retune` cambia su config sin cerrar la promesa. */
  private live: LiveSpeak | null = null;

  /** Identifica el intento de motor vigente. Un corte deja el anterior mudo. */
  private engineToken = 0;

  /** Reproducción Grok en curso (blob URL + elemento audio). */
  private grokAudio: HTMLAudioElement | null = null;
  private grokObjectUrl: string | null = null;
  private grokAbort: AbortController | null = null;

  /**
   * Audio de anclaje de la sesión web. Mantiene la Media Session mientras
   * habla la voz del sistema. No es esa voz y no se usa en el APK.
   */
  private carrierAudio: HTMLAudioElement | null = null;
  private carrierObjectUrl: string | null = null;
  private mediaHandlers: ReadAloudMediaHandlers | null = null;
  private mediaHandlersInstalled = false;

  constructor(private narrPrefs: NarratorPreferencesService) {}

  get supported(): boolean {
    return (
      this.native ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window)
    );
  }

  /**
   * Voces disponibles para el idioma indicado (prefijo BCP-47).
   * Incluye voces Grok al final si hay key local y Grok activo.
   */
  async listVoices(prefix = 'es'): Promise<NarratorVoice[]> {
    if (!this.supported) return [];
    const p = prefix.toLowerCase();

    const raw = this.native
      ? await this.nativeEngineVoices()
      : await this.webEngineVoices();
    const system = deviceCatalogForPrefix(mapDeviceEngineVoices(raw), p);

    const grok = this.narrPrefs.grokEnabled
      ? await this.fetchGrokVoices()
      : [];
    return mergeNarratorVoices(system, grok);
  }

  /**
   * Estado Grok para Ajustes (key local → xAI). No muta preferencias.
   */
  async probeGrokStatus(): Promise<{
    status: 'available' | 'no_key' | 'invalid' | 'offline' | 'disabled';
    voiceCount: number;
  }> {
    if (!this.narrPrefs.snapshot.grokEnabled) {
      return { status: 'disabled', voiceCount: 0 };
    }
    const key = this.narrPrefs.xaiApiKey;
    if (!key) {
      return { status: 'no_key', voiceCount: 0 };
    }
    if (typeof fetch === 'undefined') {
      return { status: 'offline', voiceCount: 0 };
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(xaiTtsVoicesUrl(), {
        method: 'GET',
        headers: xaiAuthHeaders(key),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 401 || res.status === 403) {
        return { status: 'invalid', voiceCount: 0 };
      }
      if (!res.ok) {
        return { status: 'offline', voiceCount: 0 };
      }
      const data = await res.json();
      const voices = parseGrokVoicesResponse(data, 'es-ES');
      if (voices.length > 0 || Array.isArray(data?.voices)) {
        return {
          status: 'available',
          voiceCount: voices.length || (data.voices?.length ?? 0),
        };
      }
      return { status: 'available', voiceCount: 0 };
    } catch {
      return { status: 'offline', voiceCount: 0 };
    }
  }

  /** Lista voces en xAI con la key del dispositivo. */
  private async fetchGrokVoices(): Promise<NarratorVoice[]> {
    const key = this.narrPrefs.xaiApiKey;
    if (!key || typeof fetch === 'undefined') return [];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(xaiTtsVoicesUrl(), {
        method: 'GET',
        headers: xaiAuthHeaders(key),
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

  /**
   * Lang, ritmo guardado y voz (dispositivo o Grok si esa es la preferencia
   * y el idioma coincide). Lectio, portada y contexto usan este plan.
   * La sesión del lector no: ahí Grok no se pronuncia.
   */
  async planUtterance(
    lang: string,
    rate?: number,
  ): Promise<{ lang: string; rate: number; voice: NarratorVoice | null }> {
    const canonical = canonicalSpeechLang(lang) || 'es-ES';
    const voices = await this.listVoices(canonical.split('-')[0] || 'es');
    return planNarratorUtterance({
      voices,
      voiceId: this.narrPrefs.voiceId,
      voiceByLang: this.narrPrefs.snapshot.voiceByLang,
      lang: canonical,
      rate: rate ?? this.narrPrefs.rate,
    });
  }

  private async nativeEngineVoices(): Promise<DeviceEngineVoice[]> {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      return (voices ?? []).map((voice, index) => ({
        voiceURI: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        index,
      }));
    } catch {
      return [];
    }
  }

  private async webEngineVoices(): Promise<DeviceEngineVoice[]> {
    const all = await this.webVoices();
    return all.map((voice, index) => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      index,
    }));
  }

  /** `speechSynthesis.getVoices()` con espera de `voiceschanged`. */
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
   * `false` si fue cancelada o falló. `retune` no cierra esta promesa:
   * sigue siendo la misma lectura, con la config nueva.
   */
  async speak(
    text: string,
    opts: { lang?: string; rate?: number; voice?: NarratorVoice | null } = {}
  ): Promise<boolean> {
    if (!this.supported || !text) return false;
    this.generation++;
    this.dropLive(false);
    await this.stopPlaybackEngines();
    const gen = this.generation;
    const lang =
      canonicalSpeechLang(opts.voice?.lang ?? opts.lang) || 'es-ES';
    const rate = opts.rate ?? 1;
    return new Promise<boolean>((resolve) => {
      if (this.generation !== gen) {
        resolve(false);
        return;
      }
      const live: LiveSpeak = {
        text,
        lang,
        rate,
        voice: opts.voice ?? null,
        gen,
        token: 0,
        cursor: 0,
        heardBoundary: false,
        startedAt: Date.now(),
        timer: null,
        settled: false,
        resolve,
      };
      this.live = live;
      this.pump(live);
    });
  }

  /**
   * Cambia voz, acento o velocidad de la locución en curso y sigue
   * desde la palabra (o la frase, si el motor solo marca frases).
   * Si no hay nada sonando, no hace nada.
   * La promesa de `speak` sigue abierta hasta que ese resto termina.
   */
  async retune(opts: NarratorSpeakPatch = {}): Promise<boolean> {
    const live = this.live;
    if (!live || live.settled) return false;
    if (typeof opts.lang === 'string' && opts.lang.trim()) live.lang = opts.lang;
    if (typeof opts.rate === 'number' && Number.isFinite(opts.rate)) {
      live.rate = opts.rate;
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'voice')) {
      live.voice = opts.voice ?? null;
    }
    const rest = resumeSpeakText(live.text, live.cursor);
    this.clearCursor(live);
    live.token = ++this.engineToken;
    if (!rest) {
      await this.stopPlaybackEngines();
      if (this.live !== live || live.settled) return false;
      this.settle(true);
      return true;
    }
    await this.stopPlaybackEngines();
    if (this.live !== live || live.settled || this.generation !== live.gen) {
      return false;
    }
    live.text = rest;
    live.cursor = 0;
    live.heardBoundary = false;
    this.pump(live);
    return true;
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

  /**
   * Engancha play, pause, anterior y siguiente del sistema a la sesión
   * del lector. En el APK no hace nada: allí sostiene el proceso el
   * servicio en primer plano.
   */
  bindReadAloudSession(handlers: ReadAloudMediaHandlers): void {
    this.mediaHandlers = handlers;
    this.installMediaHandlers();
  }

  /** Arranca el audio de anclaje dentro del gesto (clic o tecla de medios). */
  holdWebMedia(): void {
    if (this.native) return;
    const audio = this.ensureCarrier();
    if (!audio || !audio.paused) return;
    void audio.play().catch(() => undefined);
  }

  /**
   * Publica título y estado. `playing` mantiene el anclaje; `paused` e
   * `idle` lo paran. No toca la voz.
   */
  syncReadAloudMedia(input: {
    title: string;
    phase: ReadAloudPhase;
  }): void {
    if (this.native) return;
    const session = this.mediaSession();
    if (!session) return;
    this.installMediaHandlers();
    const plan = planMediaSession(input);
    try {
      session.metadata = new MediaMetadata({
        title: plan.title,
        artist: plan.artist,
      });
      session.playbackState = plan.playbackState;
    } catch {
      /* sesión no disponible */
    }
    if (plan.playbackState === 'playing') this.holdWebMedia();
    else this.pauseWebMedia();
  }

  /**
   * Al volver a primer plano: la locución web sigue, el navegador la
   * había pausado, o la cortó sin dejarla en cola.
   */
  recoverWebSpeech(): 'native' | 'live' | 'resumed' | 'dropped' {
    if (this.native) return 'native';
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return 'dropped';
    }
    const synth = window.speechSynthesis;
    if (synth.paused) {
      try {
        synth.resume();
      } catch {
        return 'dropped';
      }
      return 'resumed';
    }
    if (synth.speaking || synth.pending) return 'live';
    return 'dropped';
  }

  /** Suelta controles, metadatos y el audio de anclaje. */
  releaseReadAloudSession(): void {
    this.mediaHandlers = null;
    const session = this.mediaSession();
    if (session) {
      for (const action of MEDIA_SESSION_ACTIONS) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* acción no instalada */
        }
      }
      try {
        session.metadata = null;
        session.playbackState = 'none';
      } catch {
        /* ignore */
      }
    }
    this.stopCarrier();
    this.mediaHandlersInstalled = false;
  }

  private mediaSession(): MediaSession | null {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return null;
    }
    return navigator.mediaSession;
  }

  private installMediaHandlers(): void {
    if (this.native || this.mediaHandlersInstalled) return;
    const session = this.mediaSession();
    if (!session) return;
    const dispatch: Record<MediaSessionAction, () => void> = {
      play: () => this.mediaHandlers?.onPlay(),
      pause: () => this.mediaHandlers?.onPause(),
      previoustrack: () => this.mediaHandlers?.onPrevious(),
      nexttrack: () => this.mediaHandlers?.onNext(),
    };
    for (const action of MEDIA_SESSION_ACTIONS) {
      try {
        session.setActionHandler(action, () => dispatch[action]());
      } catch {
        /* el navegador no ofrece esta acción */
      }
    }
    this.mediaHandlersInstalled = true;
  }

  private ensureCarrier(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (this.carrierAudio) return this.carrierAudio;
    try {
      const url = URL.createObjectURL(
        new Blob([carrierWavBytes()], { type: 'audio/wav' }),
      );
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = CARRIER_ELEMENT_VOLUME;
      this.carrierObjectUrl = url;
      this.carrierAudio = audio;
      return audio;
    } catch {
      return null;
    }
  }

  private pauseWebMedia(): void {
    try {
      this.carrierAudio?.pause();
    } catch {
      /* ignore */
    }
  }

  private stopCarrier(): void {
    if (this.carrierAudio) {
      try {
        this.carrierAudio.pause();
        this.carrierAudio.src = '';
      } catch {
        /* ignore */
      }
      this.carrierAudio = null;
    }
    if (this.carrierObjectUrl) {
      try {
        URL.revokeObjectURL(this.carrierObjectUrl);
      } catch {
        /* ignore */
      }
      this.carrierObjectUrl = null;
    }
  }

  private pump(live: LiveSpeak): void {
    const token = ++this.engineToken;
    live.token = token;
    live.startedAt = Date.now();
    if (isGrokVoice(live.voice) && this.narrPrefs.grokEnabled && live.voice) {
      this.clearCursor(live);
      void this.speakGrok(live, token);
      return;
    }
    this.armCursor(live);
    if (this.native) {
      void this.speakNative(live, token);
      return;
    }
    this.speakWeb(live, token);
  }

  /** La misma identidad que el catálogo: voiceURI, o nombre + idioma. */
  private matchWebVoice(
    voice: NarratorVoice | null,
  ): SpeechSynthesisVoice | undefined {
    if (!voice || isGrokVoice(voice)) return undefined;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(
      (candidate, index) =>
        deviceVoiceId({
          voiceURI: candidate.voiceURI,
          name: candidate.name,
          lang: candidate.lang,
          localService: candidate.localService,
          index,
        }) === voice.id,
    );
  }

  /** Índice fresco. Si el id ya no está, el motor usa su voz por defecto. */
  private async matchNativeVoiceIndex(
    voice: NarratorVoice | null,
  ): Promise<number | null> {
    if (!voice || isGrokVoice(voice)) return null;
    const mapped = mapDeviceEngineVoices(await this.nativeEngineVoices());
    return engineVoiceIndex(mapped, voice.id);
  }

  /** Web Speech. El `charIndex` del límite es la palabra o la frase actual. */
  private speakWeb(live: LiveSpeak, token: number): void {
    const synth = window.speechSynthesis;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    // Chrome se traga un speak() en el mismo turno que cancel().
    setTimeout(() => {
      if (this.live !== live || live.token !== token || live.settled) return;
      const u = new SpeechSynthesisUtterance(live.text);
      u.lang = live.lang;
      u.rate = live.rate;
      const match = this.matchWebVoice(live.voice);
      if (match) u.voice = match;
      u.onboundary = (ev: SpeechSynthesisEvent) => {
        if (this.live !== live || live.token !== token) return;
        const idx = ev.charIndex;
        if (!Number.isFinite(idx) || idx <= 0) return;
        live.heardBoundary = true;
        live.cursor = wordStartAt(live.text, idx);
      };
      u.onend = () => this.finish(live, token, true);
      u.onerror = () => this.finish(live, token, false);
      synth.speak(u);
    }, 0);
  }

  private async speakNative(live: LiveSpeak, token: number): Promise<void> {
    try {
      await TextToSpeech.stop().catch(() => undefined);
      if (this.live !== live || live.token !== token || live.settled) return;
      const voiceIndex = await this.matchNativeVoiceIndex(live.voice);
      if (this.live !== live || live.token !== token || live.settled) return;
      await TextToSpeech.speak({
        text: live.text,
        lang: live.lang,
        rate: live.rate,
        pitch: 1,
        volume: 1,
        category: 'playback',
        ...(voiceIndex != null ? { voice: voiceIndex } : {}),
      });
      this.finish(live, token, true);
    } catch {
      this.finish(live, token, false);
    }
  }

  /** Sintetiza en xAI con la key del dispositivo y reproduce el audio. */
  private async speakGrok(live: LiveSpeak, token: number): Promise<void> {
    const key = this.narrPrefs.xaiApiKey;
    const voice = live.voice;
    if (!key || !voice || typeof fetch === 'undefined' || typeof Audio === 'undefined') {
      this.finish(live, token, false);
      return;
    }
    const abort = new AbortController();
    this.grokAbort = abort;
    try {
      const body = buildGrokSpeakBody({
        text: live.text,
        voice,
        language: live.lang,
        rate: live.rate,
      });
      const res = await fetch(xaiTtsSpeakUrl(), {
        method: 'POST',
        headers: {
          ...xaiAuthHeaders(key),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (this.live !== live || live.token !== token || live.settled) return;
      if (!res.ok) {
        this.finish(live, token, false);
        return;
      }
      const blob = await res.blob();
      if (this.live !== live || live.token !== token || live.settled) return;
      if (!blob || blob.size === 0) {
        this.finish(live, token, false);
        return;
      }
      this.revokeGrokUrl();
      const url = URL.createObjectURL(blob);
      this.grokObjectUrl = url;
      const audio = new Audio(url);
      this.grokAudio = audio;
      const { playbackRate } = planGrokRate(live.rate);
      try {
        audio.playbackRate = playbackRate;
      } catch {
        /* ignore */
      }
      audio.ontimeupdate = () => {
        if (this.live !== live || live.token !== token) return;
        const dur = audio.duration;
        if (!Number.isFinite(dur) || dur <= 0) return;
        const idx = Math.floor((audio.currentTime / dur) * live.text.length);
        live.heardBoundary = true;
        live.cursor = wordStartAt(live.text, idx);
      };
      audio.onended = () => {
        if (this.grokAudio === audio) this.grokAudio = null;
        this.revokeGrokUrl();
        this.finish(live, token, true);
      };
      audio.onerror = () => {
        if (this.grokAudio === audio) this.grokAudio = null;
        this.revokeGrokUrl();
        this.finish(live, token, false);
      };
      await audio.play();
      if (this.live !== live || live.token !== token || live.settled) return;
      live.startedAt = Date.now();
      this.armCursor(live);
    } catch {
      this.finish(live, token, false);
    }
  }

  private armCursor(live: LiveSpeak): void {
    this.clearCursor(live);
    live.timer = setInterval(() => {
      if (this.live !== live || live.heardBoundary || live.settled) return;
      live.cursor = estimateSpeakCharIndex(
        live.text,
        Date.now() - live.startedAt,
        live.rate,
      );
    }, 200);
  }

  private clearCursor(live: LiveSpeak | null): void {
    if (live?.timer) {
      clearInterval(live.timer);
      live.timer = null;
    }
  }

  private finish(live: LiveSpeak, token: number, ok: boolean): void {
    if (this.live !== live || live.token !== token || live.settled) return;
    this.settle(ok);
  }

  private settle(ok: boolean): void {
    const live = this.live;
    if (!live || live.settled) return;
    live.settled = true;
    this.live = null;
    this.clearCursor(live);
    live.resolve(ok);
  }

  /** Cierra la promesa viva. El motor se para aparte. */
  private dropLive(ok: boolean): void {
    this.engineToken++;
    if (this.live) this.live.token = -1;
    this.settle(ok);
  }

  private async stopPlaybackEngines(): Promise<void> {
    if (this.grokAbort) {
      try {
        this.grokAbort.abort();
      } catch {
        /* ignore */
      }
      this.grokAbort = null;
    }
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

  async cancel(): Promise<void> {
    this.generation++;
    this.dropLive(false);
    await this.stopPlaybackEngines();
  }
}
