#!/usr/bin/env node
/**
 * Launch, doctor, and drive the Documentos Vaticanos web app.
 * One long-lived static server per run. Each drive opens a fresh browser.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(skillDir, '../../..');
const runDir = path.join(skillDir, '.run');
const evidenceDir = path.join(skillDir, 'evidence');
const statePath = path.join(runDir, 'state.json');

const FEATURES = {
  inicio: {
    path: '/inicio',
    text: 'Empezar',
    selector: '.mark',
  },
  about: {
    path: '/about',
    text: 'Acerca de',
  },
  biblioteca: {
    path: '/biblioteca',
    text: 'Biblioteca',
  },
  'biblioteca-redirect': {
    path: '/documentos/listar',
    text: 'Biblioteca',
    urlIncludes: '/biblioteca',
  },
  buscar: {
    path: '/buscar',
    text: 'Buscar',
    selector: '[aria-label="Búsqueda en el texto: palabra, frase o intención"]',
  },
  cuenta: {
    path: '/cuenta',
    text: 'API no configurada. El lector offline sigue disponible.',
  },
  referencias: {
    path: '/cuenta/referencias',
    text: 'Mis referencias',
  },
  temas: {
    path: '/cuenta/temas',
    text: 'Mis temas',
  },
  'temas-detalle': {
    path: '/cuenta/temas/verify-missing',
    urlIncludes: '/cuenta/temas/verify-missing',
    selector: 'app-root',
  },
  notas: {
    path: '/notas',
    text: 'Notas',
  },
  estudio: {
    path: '/estudio',
    text: 'Estudio',
  },
  estudios: {
    path: '/estudios',
    text: 'Estudio',
  },
  'estudios-detalle': {
    path: '/estudios/verify-missing',
    urlIncludes: '/estudios/verify-missing',
    selector: 'app-root',
  },
  'estudios-editar': {
    path: '/estudios/verify-missing/editar',
    urlIncludes: '/estudios/verify-missing/editar',
    selector: 'app-root',
  },
  aprendizaje: {
    path: '/aprendizaje',
    text: 'Inicie sesión para ver su curso activo.',
  },
  explorar: {
    path: '/explorar',
    text: 'Explorar',
  },
  'explorar-relaciones': {
    path: '/explorar/relaciones',
    text: 'Explorar',
  },
  'explorar-topico': {
    path: '/explorar/topicos/aborto',
    text: 'aborto',
  },
  ajustes: {
    path: '/ajustes',
    text: 'Ajustes',
    selector: '[data-testid="ajustes-ui-locale"]',
  },
  documento: {
    path: '/documento/cic-es',
    text: 'Catecismo',
    selector: 'app-reading-cover',
  },
  'admin-revision': {
    path: '/admin/revision',
    urlIncludes: '/cuenta',
    text: 'API no configurada. El lector offline sigue disponible.',
  },
  'admin-revision-detalle': {
    path: '/admin/revision/verify-missing',
    urlIncludes: '/cuenta',
  },
  padres: {
    path: '/padres',
    text: 'Padres de la Iglesia',
  },
  'padres-detalle': {
    path: '/padres/agustin-hipona',
    text: 'Comenzar la lectura',
    selector: 'app-person-ficha',
  },
  doctores: {
    path: '/doctores',
    text: 'Doctores de la Iglesia',
  },
  'doctores-detalle': {
    path: '/doctores/agustin-hipona',
    selector: 'app-person-ficha',
    text: 'Agustín',
  },
  santoral: {
    path: '/santoral',
    text: 'Santoral',
  },
  'santoral-detalle': {
    path: '/santoral/alejandrina-maria-da-costa',
    selector: 'app-person-ficha, app-root',
    text: 'Alejandrina',
  },
  papas: {
    path: '/papas',
    text: '267 pontífices',
  },
  'papas-detalle': {
    path: '/papas/pedro',
    text: 'Pedro',
    selector: 'app-person-ficha',
  },
  lectio: {
    path: '/lectio',
    text: 'Lectio divina',
    selector: '[data-testid="lectio-date"], h1.app-title-md',
  },
  lector: {
    path: '/leyendo/cic-es/punto/2',
    selector: 'app-lector',
    urlIncludes: '/leyendo/cic-es/punto/2',
    paper: true,
    bnav: 0,
  },
  'lector-doc': {
    path: '/leyendo/cic-es',
    selector: 'app-lector',
    urlIncludes: '/leyendo/cic-es',
    paper: true,
    bnav: 0,
  },
  wildcard: {
    path: '/no-such-verify-route',
    text: 'Empezar',
    urlIncludes: '/inicio',
  },
};

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function baseUrl() {
  if (process.env.DV_VERIFY_BASE_URL) {
    return process.env.DV_VERIFY_BASE_URL.replace(/\/$/, '');
  }
  const state = readState();
  if (state?.base) return state.base;
  const port = process.env.DV_VERIFY_PORT || '4219';
  return `http://127.0.0.1:${port}`;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.setTimeout(8000, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

function resolveDist() {
  if (process.env.DV_VERIFY_DIST) return process.env.DV_VERIFY_DIST;
  const candidates = [
    path.join(repoRoot, 'frontend/dist/documentos-vaticanos'),
    path.join(repoRoot, 'dist/web'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return candidates[0];
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function doctor() {
  const base = baseUrl();
  const lines = [];
  const state = readState();
  let ok = true;
  let home;
  let manifest;
  try {
    home = await httpGet(`${base}/`);
  } catch (err) {
    console.log(`doctor fail base ${base} ${err.message}`);
    process.exit(1);
  }
  if (home.status !== 200 || !home.body.includes('<app-root')) {
    ok = false;
    lines.push(`home status ${home.status} app-root ${home.body.includes('<app-root')}`);
  }
  try {
    manifest = await httpGet(`${base}/assets/corpus/manifest.json`);
  } catch (err) {
    console.log(`doctor fail manifest ${err.message}`);
    process.exit(1);
  }
  let hasCic = false;
  let count = 0;
  try {
    const json = JSON.parse(manifest.body);
    count = Array.isArray(json.documents) ? json.documents.length : 0;
    hasCic = (json.documents || []).some((d) => d.id === 'cic-es');
  } catch {
    ok = false;
    lines.push('manifest json parse failed');
  }
  if (manifest.status !== 200 || count < 2 || !hasCic) {
    ok = false;
    lines.push(`manifest status ${manifest.status} documents ${count} cic-es ${hasCic}`);
  }
  if (state?.pid && !state.adopted && !pidAlive(state.pid)) {
    ok = false;
    lines.push(`pid ${state.pid} not alive`);
  }
  if (!ok) {
    console.log(`doctor fail base ${base}`);
    for (const line of lines) console.log(line);
    process.exit(1);
  }
  console.log('doctor ok');
  console.log(`base ${base}`);
  console.log(`home 200 app-root`);
  console.log(`manifest documents ${count} cic-es present`);
  if (state?.pid) console.log(`pid ${state.pid} adopted ${Boolean(state.adopted)}`);
}

async function launch() {
  const port = String(process.env.DV_VERIFY_PORT || '4219');
  const base = process.env.DV_VERIFY_BASE_URL
    ? process.env.DV_VERIFY_BASE_URL.replace(/\/$/, '')
    : `http://127.0.0.1:${port}`;
  if (process.env.DV_VERIFY_BASE_URL) {
    writeState({ base, port: null, pid: null, adopted: true, dist: null });
    process.env.DV_VERIFY_BASE_URL = base;
    await doctor();
    console.log('launch adopted');
    return;
  }
  const existing = readState();
  if (
    !process.env.DV_VERIFY_FORCE_SERVE &&
    existing?.pid &&
    pidAlive(existing.pid) &&
    existing.base === base
  ) {
    await doctor();
    console.log('launch ready');
    console.log(`reused pid ${existing.pid}`);
    return;
  }
  if (existing?.pid && pidAlive(existing.pid) && !existing.adopted) {
    try {
      process.kill(existing.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  const dist = resolveDist();
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.log(`launch fail missing ${dist}/index.html`);
    process.exit(1);
  }
  fs.mkdirSync(runDir, { recursive: true });
  const logPath = path.join(runDir, 'server.log');
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(process.execPath, [path.join(repoRoot, 'e2e/spa-static.js'), dist, port], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);
  writeState({
    base,
    port: Number(port),
    pid: child.pid,
    adopted: false,
    dist,
  });
  const deadline = Date.now() + 20000;
  let lastErr = 'not ready';
  while (Date.now() < deadline) {
    try {
      const home = await httpGet(`${base}/`);
      if (home.status === 200 && home.body.includes('<app-root')) {
        await doctor();
        console.log('launch ready');
        console.log(`pid ${child.pid}`);
        console.log(`dist ${dist}`);
        return;
      }
      lastErr = `status ${home.status}`;
    } catch (err) {
      lastErr = err.message;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`launch fail ${lastErr}`);
  process.exit(1);
}

function cleanup() {
  const state = readState();
  if (state?.pid && !state.adopted) {
    try {
      process.kill(state.pid, 'SIGTERM');
      console.log(`cleanup killed ${state.pid}`);
    } catch (err) {
      console.log(`cleanup pid ${state.pid} ${err.message}`);
    }
  } else {
    console.log('cleanup no owned pid');
  }
  fs.rmSync(runDir, { recursive: true, force: true });
  const evidenceOk = fs.existsSync(evidenceDir);
  console.log(`cleanup evidence kept ${evidenceOk} ${evidenceDir}`);
}

async function drive(name) {
  const feature = FEATURES[name];
  if (!feature) {
    console.log(`drive fail unknown feature ${name}`);
    console.log(`known ${Object.keys(FEATURES).join(' ')}`);
    process.exit(1);
  }
  const base = baseUrl();
  const require = createRequire(path.join(repoRoot, 'e2e/package.json'));
  const { chromium } = require('playwright');
  const executablePath = process.env.DV_VERIFY_CHROMIUM || '/usr/bin/chromium';
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    const prefs = {
      theme: 'mono',
      font: 'serif',
      fontSizePx: 18,
      lineHeight: 1.65,
      maxWidthCh: 65,
      keepAwake: false,
      contentLocale: 'es',
      uiLocale: 'es',
    };
    localStorage.setItem('reader.prefs.v1', JSON.stringify(prefs));
  });
  const action = `${base}${feature.path}`;
  const lines = [`feature ${name}`, `action GET ${feature.path}`, `action_url ${action}`];
  let failed = false;
  try {
    await page.goto(action, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (feature.selector) {
      await page.locator(feature.selector.split(',')[0].trim()).first().waitFor({
        state: 'attached',
        timeout: 60000,
      });
    }
    if (feature.text) {
      await page.getByText(feature.text, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 60000,
      });
    }
    if (feature.paper) {
      await page.locator('app-punto').first().waitFor({
        state: 'visible',
        timeout: 60000,
      });
      lines.push('app-punto visible');
    }
    if (feature.bnav !== undefined) {
      const count = await page.locator('.bnav').count();
      lines.push(`bnav ${count}`);
      if (count !== feature.bnav) failed = true;
    }
    const url = page.url();
    lines.push(`result_url ${url}`);
    if (feature.urlIncludes && !url.includes(feature.urlIncludes)) {
      lines.push(`url mismatch wanted ${feature.urlIncludes}`);
      failed = true;
    }
    const excerpt = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 280);
    lines.push(`excerpt ${excerpt}`);
  } catch (err) {
    failed = true;
    lines.push(`error ${err.message}`);
    try {
      lines.push(`result_url ${page.url()}`);
    } catch {
      /* page already closed */
    }
  } finally {
    await browser.close();
  }
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `${name}.txt`);
  fs.writeFileSync(evidencePath, `${lines.join('\n')}\n`);
  lines.push(`evidence ${evidencePath}`);
  console.log(lines.join('\n'));
  if (failed) process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'launch') {
  await launch();
} else if (cmd === 'doctor') {
  await doctor();
} else if (cmd === 'drive') {
  await drive(arg || 'lector');
} else if (cmd === 'cleanup') {
  cleanup();
} else {
  console.log('usage: dv-verify.mjs launch|doctor|drive <feature>|cleanup');
  process.exit(2);
}
