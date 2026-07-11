import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'digital.documentosvaticanos.app',
  appName: 'Documentos Vaticanos',
  webDir: 'dist/documentos-vaticanos',
  server: { androidScheme: 'https' },
};

export default config;
