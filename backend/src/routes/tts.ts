/**
 * Proxy TTS Grok (xAI) — clave solo en servidor.
 *
 * GET  /tts/voices  → { available, voices[] }  (sin clave: available=false)
 * POST /tts/speak   → audio/* o 503/4xx controlados
 *
 * Público (sin JWT): el lector offline-first no exige login; el operador
 * paga la API. No es chatbot; solo síntesis de la unidad de lectura.
 *
 * Factibilidad: SuperGrok/Heavy ≠ XAI_API_KEY (console.x.ai, ~$15/1M chars).
 * ES: es-ES / es-MX. Endpoints upstream POST /v1/tts y GET /v1/tts/voices.
 */
import { Router } from 'express';
import { config, isGrokTtsConfigured } from '../config';
import {
  createXaiTtsClient,
  validateTtsText,
  XaiTtsError,
  type XaiTtsVoice,
  type SynthesizeInput,
  type SynthesizeResult,
} from '../services/xaiTts';

export type TtsClient = {
  listVoices: () => Promise<XaiTtsVoice[]>;
  synthesize: (input: SynthesizeInput) => Promise<SynthesizeResult>;
};

export type TtsRouterDeps = {
  /** Si se omite, usa isGrokTtsConfigured() de config. */
  isConfigured?: () => boolean;
  /** Si se omite, crea cliente con config.xaiApiKey. */
  getClient?: () => TtsClient;
};

export function createTtsRouter(deps: TtsRouterDeps = {}): Router {
  const router = Router();
  const isConfigured = deps.isConfigured ?? isGrokTtsConfigured;
  const getClient =
    deps.getClient ??
    (() =>
      createXaiTtsClient({
        apiKey: config.xaiApiKey,
        baseUrl: config.xaiTtsBaseUrl,
      }));

  router.get('/tts/voices', async (_req, res) => {
    if (!isConfigured()) {
      res.json({
        available: false,
        voices: [],
        reason: 'XAI_API_KEY not configured',
      });
      return;
    }
    try {
      const voices = await getClient().listVoices();
      res.json({
        available: true,
        voices: voices.map((v) => ({
          voice_id: v.voice_id,
          name: v.name ?? v.voice_id,
        })),
      });
    } catch (e) {
      const err = e as XaiTtsError;
      console.error(
        '[tts] list voices',
        err.message,
        err.upstreamBody?.slice(0, 200),
      );
      res.status(err.status && err.status >= 400 ? err.status : 502).json({
        available: false,
        voices: [],
        error: err.message || 'Failed to list Grok voices',
      });
    }
  });

  router.post('/tts/speak', async (req, res) => {
    if (!isConfigured()) {
      res.status(503).json({
        error: 'Grok TTS not configured (set XAI_API_KEY on the server)',
        code: 'tts_unavailable',
      });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const validation = validateTtsText(text);
    if (validation) {
      res.status(400).json({ error: validation, code: 'invalid_text' });
      return;
    }

    const voiceId =
      typeof req.body?.voice_id === 'string'
        ? req.body.voice_id
        : typeof req.body?.voiceId === 'string'
          ? req.body.voiceId
          : 'eve';
    const language =
      typeof req.body?.language === 'string' ? req.body.language : 'es-ES';
    const speed =
      req.body?.speed != null && Number.isFinite(Number(req.body.speed))
        ? Number(req.body.speed)
        : undefined;

    try {
      const result = await getClient().synthesize({
        text,
        voiceId,
        language,
        speed,
      });
      const buf = Buffer.from(result.body);
      if (!buf.length) {
        res
          .status(502)
          .json({ error: 'Empty audio from upstream', code: 'empty_audio' });
        return;
      }
      res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buf);
    } catch (e) {
      const err = e as XaiTtsError;
      console.error(
        '[tts] speak',
        err.message,
        err.upstreamBody?.slice(0, 200),
      );
      const status =
        err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      // No reenviar 401 de xAI como 401 de la app (confundiría con JWT)
      const outStatus = status === 401 ? 502 : status;
      res.status(outStatus).json({
        error: err.message || 'TTS synthesis failed',
        code: 'tts_upstream_error',
      });
    }
  });

  return router;
}

/** Router de producción (lee config / XAI_API_KEY del entorno). */
export const ttsRouter = createTtsRouter();
