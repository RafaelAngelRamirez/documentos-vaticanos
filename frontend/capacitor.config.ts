import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Live reload on emulator: CAP_LIVE_RELOAD=1
 * Emulator reaches the host via 10.0.2.2 (override with CAP_LIVE_URL).
 * Do not set this in production/CI APKs.
 */
const liveReload = process.env.CAP_LIVE_RELOAD === '1';

const config: CapacitorConfig = {
  appId: 'digital.documentosvaticanos.app',
  appName: 'Documentos Vaticanos',
  webDir: 'dist/documentos-vaticanos',
  server: liveReload
    ? {
        url: process.env.CAP_LIVE_URL || 'http://10.0.2.2:4200',
        cleartext: true,
        androidScheme: 'http',
      }
    : { androidScheme: 'https' },
};

export default config;
