/**
 * Preload: expose a minimal flag so the Angular app can detect the Electron shell
 * (e.g. disable service worker if needed). No Node APIs leak to the page.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('documentosVaticanosShell', {
  kind: 'electron',
});
