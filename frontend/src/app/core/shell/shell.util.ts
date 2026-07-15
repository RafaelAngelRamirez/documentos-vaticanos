/**
 * Shell detection shared by download gates, service worker, and app-update.
 * Keep free of Angular DI so pure tests and early bootstrap can call it.
 */

/** Electron shell (preload flag or userAgent). */
export function detectElectronShell(): boolean {
  if (typeof window !== 'undefined') {
    const shell = (
      window as Window & {
        documentosVaticanosShell?: { kind?: string };
      }
    ).documentosVaticanosShell;
    if (shell?.kind === 'electron') {
      return true;
    }
  }
  return (
    typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
  );
}

/**
 * Browser web shell only: not Capacitor native, not Electron packaged app.
 * Used to gate public download icons on Inicio.
 */
export function isWebDownloadShell(
  isNativePlatform: boolean,
  isElectron: boolean
): boolean {
  return !isNativePlatform && !isElectron;
}
