/**
 * Electron main process — loads the same production Angular web tree offline.
 * One web base (AGENTS.md): Electron only wraps frontend/dist/documentos-vaticanos.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { assertWebDistReady } = require('./paths');
const { startStaticServer } = require('./static-server');

/** Manual installer downloads: renderer asks main to open the system browser. */
ipcMain.on('dv:open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url).catch((err) => {
      console.error('[electron] openExternal failed:', err);
    });
  }
});


/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {{ close: () => Promise<void>, url: string } | null} */
let staticServer = null;

const isDev = process.env.DV_ELECTRON_DEV === '1';
const smokeExitMs = Number(process.env.DV_ELECTRON_SMOKE_MS || 0);

/**
 * Chrome sandbox needs setuid chrome-sandbox; many Linux/CI envs lack it.
 * Opt out via env, or auto-detect unprivileged sandbox binary.
 */
function shouldDisableSandbox() {
  if (
    process.env.DV_ELECTRON_NO_SANDBOX === '1' ||
    process.env.ELECTRON_DISABLE_SANDBOX === '1'
  ) {
    return true;
  }
  if (process.platform !== 'linux') {
    return false;
  }
  try {
    const sandboxBin = path.join(path.dirname(process.execPath), 'chrome-sandbox');
    if (!fs.existsSync(sandboxBin)) {
      return true;
    }
    const mode = fs.statSync(sandboxBin).mode;
    // setuid bit 0o4000 required for Chromium sandbox
    if ((mode & 0o4000) === 0) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

if (shouldDisableSandbox()) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  console.log('[electron] chrome sandbox disabled (env or non-setuid sandbox)');
}

async function createWindow() {
  const { webDist, indexHtml } = assertWebDistReady();

  // Serve over localhost so <base href="/"> and PathLocationStrategy work.
  staticServer = await startStaticServer(webDist);
  const loadUrl = staticServer.url;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 480,
    show: smokeExitMs <= 0,
    title: 'Documentos Vaticanos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, validatedURL) => {
    console.error(
      `[electron] did-fail-load code=${code} desc=${desc} url=${validatedURL}`
    );
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[electron] loaded ${loadUrl} (assets from ${indexHtml})`);
    if (smokeExitMs > 0) {
      setTimeout(() => {
        console.log('[electron] smoke exit');
        app.quit();
      }, smokeExitMs);
    }
  });

  await mainWindow.loadURL(loadUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (err) {
    console.error('[electron] startup failed:', err);
    app.exit(1);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((err) => {
        console.error('[electron] activate failed:', err);
        app.exit(1);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close().catch(() => {});
    staticServer = null;
  }
});
