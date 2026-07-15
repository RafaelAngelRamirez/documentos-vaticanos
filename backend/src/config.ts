import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  // Comma-separated origins for local Angular + Capacitor
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL ?? '',

  googleClientIds: (process.env.GOOGLE_CLIENT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-only-change-me'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '1h',
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),

  /** Accept idToken "dev:..." without Google — never enable in production. */
  devAuthBypass: bool('DEV_AUTH_BYPASS', false) && !isProd,

  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024),

  /**
   * xAI TTS (Grok Voice) — API de console.x.ai, NO SuperGrok/SuperGrok Heavy.
   * SuperGrok es suscripción del chat Grok; el TTS requiere `XAI_API_KEY` con
   * facturación API aparte (~$15/1M chars). La clave solo vive en el servidor.
   * @see https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
   */
  xaiApiKey: (process.env.XAI_API_KEY ?? '').trim(),
  xaiTtsBaseUrl: (
    process.env.XAI_TTS_BASE_URL ?? 'https://api.x.ai/v1'
  ).replace(/\/$/, ''),
} as const;

/** True when the server can proxy Grok TTS (key present). */
export function isGrokTtsConfigured(): boolean {
  return Boolean(config.xaiApiKey);
}
