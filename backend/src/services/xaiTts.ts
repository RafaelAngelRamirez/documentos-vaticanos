/**
 * Cliente xAI Text-to-Speech (Grok Voice).
 *
 * Factibilidad (API pública xAI):
 * - `POST https://api.x.ai/v1/tts` → audio (default MP3)
 * - `GET  https://api.x.ai/v1/tts/voices` → lista de `voice_id`
 * - Español: `es-ES`, `es-MX` (BCP-47)
 * - Auth: `Authorization: Bearer $XAI_API_KEY` de console.x.ai (facturación API).
 * - SuperGrok / SuperGrok Heavy **no** sustituye la API key.
 * - Precio orientativo TTS: ~$15 / 1M caracteres.
 * - Nunca exponer la clave al cliente; solo proxy backend.
 *
 * @see https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
 */

export const XAI_TTS_MAX_CHARS = 15_000;

export type XaiTtsVoice = {
  voice_id: string;
  name?: string;
  [key: string]: unknown;
};

export type SynthesizeInput = {
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
};

export type SynthesizeResult = {
  body: ArrayBuffer;
  contentType: string;
};

export type XaiTtsClientOptions = {
  apiKey: string;
  baseUrl?: string;
  /** Inyectable para tests (stubs de red externa). */
  fetchImpl?: typeof fetch;
};

/** Construye el cuerpo JSON del POST /tts (pure, testeable). */
export function buildTtsRequestBody(input: SynthesizeInput): Record<string, unknown> {
  const text = String(input.text ?? '').trim();
  const language = (input.language ?? 'es-ES').trim() || 'es-ES';
  const body: Record<string, unknown> = {
    text,
    language,
    voice_id: (input.voiceId ?? 'eve').trim() || 'eve',
  };
  if (input.speed != null && Number.isFinite(input.speed)) {
    // xAI: 0.7–1.5; narrador UI usa 0.75–1.5
    const speed = Math.min(1.5, Math.max(0.7, Number(input.speed)));
    body.speed = speed;
  }
  return body;
}

export function validateTtsText(text: string): string | null {
  const t = String(text ?? '').trim();
  if (!t) return 'text is required';
  if (t.length > XAI_TTS_MAX_CHARS) {
    return `text exceeds ${XAI_TTS_MAX_CHARS} characters`;
  }
  return null;
}

export function createXaiTtsClient(opts: XaiTtsClientOptions) {
  const baseUrl = (opts.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const authHeader = { Authorization: `Bearer ${opts.apiKey}` };

  async function listVoices(): Promise<XaiTtsVoice[]> {
    const res = await fetchImpl(`${baseUrl}/tts/voices`, {
      method: 'GET',
      headers: { ...authHeader },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new XaiTtsError(
        `xAI list voices failed: ${res.status}`,
        res.status,
        errText,
      );
    }
    const data = (await res.json()) as { voices?: XaiTtsVoice[] };
    return Array.isArray(data.voices) ? data.voices : [];
  }

  async function synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const err = validateTtsText(input.text);
    if (err) throw new XaiTtsError(err, 400);
    const body = buildTtsRequestBody(input);
    const res = await fetchImpl(`${baseUrl}/tts`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new XaiTtsError(
        `xAI TTS failed: ${res.status}`,
        res.status >= 400 && res.status < 600 ? res.status : 502,
        errText,
      );
    }
    const contentType =
      res.headers.get('content-type') || 'audio/mpeg';
    const ab = await res.arrayBuffer();
    return { body: ab, contentType };
  }

  return { listVoices, synthesize, baseUrl };
}

export class XaiTtsError extends Error {
  status: number;
  upstreamBody?: string;

  constructor(message: string, status = 502, upstreamBody?: string) {
    super(message);
    this.name = 'XaiTtsError';
    this.status = status;
    this.upstreamBody = upstreamBody;
  }
}
