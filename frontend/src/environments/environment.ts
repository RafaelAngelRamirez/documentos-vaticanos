export const environment = {
  production: false,
  version: '0.0.25',
  apiBaseUrl: 'http://localhost:3000/api/v1',
  /** When true, show "dev login" form (matches backend DEV_AUTH_BYPASS). */
  devAuthBypass: true,
  googleClientId: '',
  /**
   * Public origin for installer manifest + download links (APK / Electron).
   * Native and Electron shells always check this remote host — not same-origin
   * of the embedded static pack — so a new publish is visible without reinstall.
   */
  downloadsPublicOrigin: 'https://docvat.codice-progressio.online',
  /**
   * Offline topic-search pack (`assets/corpus/search/`). When false, loader
   * returns empty packs without HTTP. Opt-out via reader prefs later.
   */
  featureTopicSearch: true,
};
