/**
 * Preload: expose a minimal shell bridge so the Angular app can detect Electron
 * and open external installer URLs via the main process (no Node APIs leak).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('documentosVaticanosShell', {
  kind: 'electron',
  /** process.platform from main (win32 | linux | darwin). */
  platform: process.platform,
  /** Open installer / download URL in the OS browser. */
  openExternal: (url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      ipcRenderer.send('dv:open-external', url);
    }
  },
});
