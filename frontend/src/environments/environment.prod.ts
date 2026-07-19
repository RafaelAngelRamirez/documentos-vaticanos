export const environment = {
  production: true,
  version: '0.0.19',
  apiBaseUrl: '', // set at deploy or leave empty to disable online features
  devAuthBypass: false,
  googleClientId: '',
  /**
   * Public origin for installer manifest + download links (APK / Electron).
   * Must stay absolute so Capacitor/Electron do not read the empaquetado stub.
   */
  downloadsPublicOrigin: 'https://docvat.codice-progressio.online',
};
