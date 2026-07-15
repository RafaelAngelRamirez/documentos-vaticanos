/**
 * Structural + pure-logic tests for download paths / manifest (no Angular runtime).
 * Run from frontend/: node src/app/core/downloads/downloads.paths.test.js
 * Or monorepo: npm run test:downloads
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// __dirname = frontend/src/app/core/downloads → up 4 → frontend
const FRONTEND = path.resolve(__dirname, '../../../..');
const ROOT = path.resolve(FRONTEND, '..');

const STABLE = {
  apk: '/downloads/documentos-vaticanos.apk',
  linux: '/downloads/documentos-vaticanos-linux.AppImage',
  windows: '/downloads/documentos-vaticanos-windows.exe',
  manifest: '/downloads/manifest.json',
};

function section(name) {
  console.log(`\n== ${name} ==`);
}

function normalize(m) {
  const base = {
    app: 'documentos-vaticanos',
    version: '0.0.0',
    builtAt: null,
    downloads: {
      apk: STABLE.apk,
      linux: STABLE.linux,
      windows: STABLE.windows,
    },
  };
  if (!m || typeof m !== 'object') return base;
  return {
    app: m.app || base.app,
    version: m.version || base.version,
    builtAt: m.builtAt ?? null,
    downloads: {
      apk: (m.downloads && m.downloads.apk) || base.downloads.apk,
      linux: (m.downloads && m.downloads.linux) || base.downloads.linux,
      windows: (m.downloads && m.downloads.windows) || base.downloads.windows,
    },
  };
}

function main() {
  section('stable path constants');
  assert.ok(STABLE.apk.startsWith('/downloads/'));
  assert.ok(STABLE.linux.endsWith('.AppImage'));
  assert.ok(STABLE.windows.endsWith('.exe'));
  assert.ok(STABLE.apk.endsWith('.apk'));

  section('assets manifest stub exists and is valid JSON');
  const assetsManifest = path.join(
    FRONTEND,
    'src/assets/downloads/manifest.json'
  );
  assert.ok(fs.existsSync(assetsManifest), 'assets downloads manifest');
  const stub = JSON.parse(fs.readFileSync(assetsManifest, 'utf8'));
  assert.strictEqual(stub.app, 'documentos-vaticanos');
  assert.ok(stub.downloads.apk.includes('documentos-vaticanos.apk'));
  assert.ok(stub.downloads.linux.includes('AppImage'));
  assert.ok(stub.downloads.windows.includes('.exe'));

  section('normalize fills missing keys from stable paths');
  const empty = normalize({});
  assert.strictEqual(empty.downloads.apk, STABLE.apk);
  assert.strictEqual(empty.downloads.linux, STABLE.linux);
  assert.strictEqual(empty.downloads.windows, STABLE.windows);

  const partial = normalize({
    version: '1.2.3',
    downloads: { apk: '/downloads/custom.apk' },
  });
  assert.strictEqual(partial.version, '1.2.3');
  assert.strictEqual(partial.downloads.apk, '/downloads/custom.apk');
  assert.strictEqual(partial.downloads.linux, STABLE.linux);

  section('collect script exists and wires stable names');
  const collect = path.join(ROOT, 'scripts/package-collect-downloads.sh');
  assert.ok(fs.existsSync(collect), 'package-collect-downloads.sh');
  const collectBody = fs.readFileSync(collect, 'utf8');
  for (const name of [
    'documentos-vaticanos.apk',
    'documentos-vaticanos-linux.AppImage',
    'documentos-vaticanos-windows.exe',
    'manifest.json',
  ]) {
    assert.ok(collectBody.includes(name), `collect script mentions ${name}`);
  }

  section('package-electron supports windows target');
  const electronSh = path.join(ROOT, 'scripts/package-electron.sh');
  const electronBody = fs.readFileSync(electronSh, 'utf8');
  assert.ok(/--win|windows|nsis/i.test(electronBody), 'win/nsis in package-electron');
  assert.ok(/linux/i.test(electronBody), 'linux in package-electron');

  section('package-all collects downloads');
  const allSh = fs.readFileSync(path.join(ROOT, 'scripts/package-all.sh'), 'utf8');
  assert.ok(allSh.includes('package-collect-downloads'), 'package-all runs collect');

  section('CI build requires APK + electron win/linux + deploy');
  const ci = fs.readFileSync(path.join(ROOT, '.ci-build.sh'), 'utf8');
  assert.ok(ci.includes('package-apk'), 'ci builds apk');
  assert.ok(ci.includes('package-electron'), 'ci builds electron');
  assert.ok(ci.includes('package-collect-downloads'), 'ci collects downloads');
  assert.ok(ci.includes('ci-deploy-docvat'), 'ci deploys docvat');
  assert.ok(ci.includes('DV_REQUIRE_WIN') || ci.includes('win'), 'ci wants windows');

  section('Dockerfile + nginx serve /downloads');
  const dockerfile = fs.readFileSync(path.join(FRONTEND, 'Dockerfile'), 'utf8');
  assert.ok(dockerfile.includes('nginx.conf'), 'Dockerfile uses nginx.conf');
  const nginx = fs.readFileSync(path.join(FRONTEND, 'nginx.conf'), 'utf8');
  assert.ok(nginx.includes('/downloads/'), 'nginx serves /downloads/');

  section('About UI links downloads');
  const aboutHtml = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/about/about.component.html'),
    'utf8'
  );
  assert.ok(
    aboutHtml.includes('documentos-vaticanos.apk') ||
      aboutHtml.includes('downloads') ||
      aboutHtml.includes('links.apk'),
    'about page exposes download links'
  );

  section('Inicio (3A) web-only quick downloads + version');
  const inicioHtml = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/inicio/inicio.component.html'),
    'utf8'
  );
  const inicioTs = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/inicio/inicio.component.ts'),
    'utf8'
  );
  assert.ok(inicioHtml.includes('showDownloads'), 'inicio gates downloads');
  assert.ok(inicioHtml.includes('versionLabel'), 'inicio shows version label');
  assert.ok(inicioHtml.includes('inicio-dl-android'), 'inicio android download');
  assert.ok(inicioHtml.includes('inicio-dl-windows'), 'inicio windows download');
  assert.ok(inicioHtml.includes('inicio-dl-linux'), 'inicio linux download');
  assert.ok(inicioHtml.includes('links.apk'), 'inicio uses resolved apk path');
  assert.ok(inicioHtml.includes('links.windows'), 'inicio uses resolved windows path');
  assert.ok(inicioHtml.includes('links.linux'), 'inicio uses resolved linux path');
  assert.ok(
    inicioTs.includes('isWebDownloadShell') && inicioTs.includes('DownloadsService'),
    'inicio wires DownloadsService + web-only shell gate'
  );
  assert.ok(
    inicioTs.includes('formatVersionLabel') || inicioTs.includes("v${"),
    'inicio formats version with v prefix'
  );

  console.log('\nAll downloads path tests passed.');
}

main();
