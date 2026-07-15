/**
 * Unit + structural tests for app-update pure logic (shipped TypeScript module).
 * Loads the real `app-update.logic.ts` via Node type stripping — does NOT reimplement.
 *
 * Run:
 *   node --experimental-strip-types src/app/core/downloads/app-update.logic.test.js
 * Monorepo:
 *   npm run test:app-update
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FRONTEND = path.resolve(HERE, '../../../..');
const ROOT = path.resolve(FRONTEND, '..');
const LOGIC_TS = path.join(HERE, 'app-update.logic.ts');
const SERVICE_TS = path.join(HERE, 'app-update.service.ts');
const ORIGIN = 'https://docvat.codice-progressio.online';

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  // Import the SHIPPED pure module (TypeScript stripped by Node).
  const mod = await import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
  return mod;
}

function fixtureManifest(version, downloads) {
  return {
    app: 'documentos-vaticanos',
    version,
    builtAt: null,
    downloads: downloads || {
      apk: '/downloads/documentos-vaticanos.apk',
      linux: '/downloads/documentos-vaticanos-linux.AppImage',
      windows: '/downloads/documentos-vaticanos-windows.exe',
    },
  };
}

async function main() {
  section('shipped pure module exists');
  assert.ok(fs.existsSync(LOGIC_TS), 'app-update.logic.ts');
  assert.ok(fs.existsSync(SERVICE_TS), 'app-update.service.ts');

  const {
    compareSemver,
    isRemoteNewer,
    parseSemver,
    resolveUpdate,
    detectUpdatePlatform,
    absolutizeDownloadUrl,
    remoteManifestUrl,
    shouldAutoCheckAppUpdate,
  } = await loadLogic();

  section('parseSemver / compareSemver');
  assert.deepStrictEqual(parseSemver('1.2.3'), [1, 2, 3]);
  assert.deepStrictEqual(parseSemver('v0.0.13'), [0, 0, 13]);
  assert.deepStrictEqual(parseSemver('2.0'), [2, 0, 0]);
  assert.strictEqual(parseSemver(''), null);
  assert.strictEqual(parseSemver('not-a-version'), null);
  assert.strictEqual(parseSemver(null), null);
  assert.ok(compareSemver('1.0.0', '1.0.1') < 0);
  assert.ok(compareSemver('2.0.0', '1.9.9') > 0);
  assert.strictEqual(compareSemver('1.2.3', '1.2.3'), 0);
  assert.strictEqual(compareSemver('v1.2.3', '1.2.3'), 0);
  assert.strictEqual(compareSemver('bad', '1.0.0'), null);

  section('isRemoteNewer');
  assert.strictEqual(isRemoteNewer('0.0.13', '0.0.14'), true);
  assert.strictEqual(isRemoteNewer('0.0.13', '0.0.13'), false);
  assert.strictEqual(isRemoteNewer('1.0.0', '0.9.9'), false);
  assert.strictEqual(isRemoteNewer('x', '1.0.0'), false);

  section('resolveUpdate: same version → no update');
  {
    const r = resolveUpdate(
      '0.0.13',
      fixtureManifest('0.0.13'),
      'apk',
      ORIGIN
    );
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'same_or_older');
  }

  section('resolveUpdate: remote greater → update + platform URL');
  {
    const r = resolveUpdate(
      '0.0.13',
      fixtureManifest('0.0.20'),
      'apk',
      ORIGIN
    );
    assert.strictEqual(r.available, true);
    assert.strictEqual(r.version, '0.0.20');
    assert.strictEqual(r.platform, 'apk');
    assert.strictEqual(
      r.downloadUrl,
      ORIGIN + '/downloads/documentos-vaticanos.apk'
    );
    assert.strictEqual(r.localVersion, '0.0.13');
  }
  {
    const r = resolveUpdate(
      '1.0.0',
      fixtureManifest('2.0.0'),
      'linux',
      ORIGIN
    );
    assert.strictEqual(r.available, true);
    assert.strictEqual(
      r.downloadUrl,
      ORIGIN + '/downloads/documentos-vaticanos-linux.AppImage'
    );
  }
  {
    const r = resolveUpdate(
      '1.0.0',
      fixtureManifest('1.1.0'),
      'windows',
      ORIGIN
    );
    assert.strictEqual(r.available, true);
    assert.ok(r.downloadUrl.endsWith('.exe'));
  }

  section('resolveUpdate: remote older / invalid / missing → no false update');
  {
    const r = resolveUpdate(
      '2.0.0',
      fixtureManifest('1.0.0'),
      'apk',
      ORIGIN
    );
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'same_or_older');
  }
  {
    const r = resolveUpdate('0.0.1', fixtureManifest('not-semver'), 'apk', ORIGIN);
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'invalid_remote');
  }
  {
    const r = resolveUpdate('bad', fixtureManifest('1.0.0'), 'apk', ORIGIN);
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'invalid_local');
  }
  {
    const r = resolveUpdate('0.0.1', null, 'apk', ORIGIN);
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'no_manifest');
  }
  {
    const r = resolveUpdate('0.0.1', fixtureManifest('1.0.0'), null, ORIGIN);
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.reason, 'no_platform');
  }
  {
    const m = fixtureManifest('9.0.0', {
      apk: null,
      linux: null,
      windows: null,
    });
    // STABLE_DOWNLOAD_PATHS still fills path via resolveUpdate fallback
    const r = resolveUpdate('1.0.0', m, 'apk', ORIGIN);
    // available true because stable paths kick in
    assert.strictEqual(r.available, true);
    assert.ok(r.downloadUrl.includes('documentos-vaticanos.apk'));
  }

  section('detectUpdatePlatform');
  assert.strictEqual(
    detectUpdatePlatform({ isNativePlatform: true, isElectron: false }),
    'apk'
  );
  assert.strictEqual(
    detectUpdatePlatform({
      isNativePlatform: false,
      isElectron: true,
      processPlatform: 'linux',
    }),
    'linux'
  );
  assert.strictEqual(
    detectUpdatePlatform({
      isNativePlatform: false,
      isElectron: true,
      processPlatform: 'win32',
    }),
    'windows'
  );
  assert.strictEqual(
    detectUpdatePlatform({ isNativePlatform: false, isElectron: false }),
    null
  );

  section('absolutizeDownloadUrl + remoteManifestUrl');
  assert.strictEqual(
    absolutizeDownloadUrl('/downloads/x.apk', ORIGIN),
    ORIGIN + '/downloads/x.apk'
  );
  assert.strictEqual(
    absolutizeDownloadUrl('https://cdn.example/a.apk', ORIGIN),
    'https://cdn.example/a.apk'
  );
  assert.strictEqual(
    remoteManifestUrl(ORIGIN),
    ORIGIN + '/downloads/manifest.json'
  );

  section('shouldAutoCheckAppUpdate gates web');
  assert.strictEqual(
    shouldAutoCheckAppUpdate({ isNativePlatform: false, isElectron: false }),
    false
  );
  assert.strictEqual(
    shouldAutoCheckAppUpdate({ isNativePlatform: true, isElectron: false }),
    true
  );
  assert.strictEqual(
    shouldAutoCheckAppUpdate({ isNativePlatform: false, isElectron: true }),
    true
  );

  section('service uses remote production origin (not only same-origin)');
  const serviceSrc = fs.readFileSync(SERVICE_TS, 'utf8');
  assert.ok(
    serviceSrc.includes('downloadsPublicOrigin') ||
      serviceSrc.includes('docvat.codice-progressio.online'),
    'service references public downloads origin'
  );
  assert.ok(
    serviceSrc.includes('resolveUpdate'),
    'service calls shipped resolveUpdate'
  );
  assert.ok(
    serviceSrc.includes('shouldAutoCheckAppUpdate') ||
      serviceSrc.includes('isNativePlatform'),
    'service gates on native/electron'
  );
  assert.ok(
    serviceSrc.includes('catchError') || serviceSrc.includes('catch'),
    'service swallows network errors'
  );

  section('environments pin public downloads origin');
  for (const rel of [
    'src/environments/environment.ts',
    'src/environments/environment.prod.ts',
  ]) {
    const body = fs.readFileSync(path.join(FRONTEND, rel), 'utf8');
    assert.ok(
      body.includes('downloadsPublicOrigin'),
      `${rel} has downloadsPublicOrigin`
    );
    assert.ok(
      body.includes('docvat.codice-progressio.online'),
      `${rel} points at production host`
    );
  }

  section('AppComponent bootstraps AppUpdateService');
  const appComp = fs.readFileSync(
    path.join(FRONTEND, 'src/app/app.component.ts'),
    'utf8'
  );
  assert.ok(appComp.includes('AppUpdateService'), 'app.component injects update');
  assert.ok(appComp.includes('checkForUpdate'), 'app.component triggers check');

  section('UI surfaces: Ajustes + Inicio CTA');
  const ajustesHtml = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/ajustes/ajustes.component.html'),
    'utf8'
  );
  assert.ok(ajustesHtml.includes('ajustes-update-card'), 'ajustes update card');
  assert.ok(
    ajustesHtml.includes('ajustes-update-download'),
    'ajustes download CTA'
  );
  const inicioHtml = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/inicio/inicio.component.html'),
    'utf8'
  );
  assert.ok(inicioHtml.includes('inicio-update'), 'inicio update banner');
  assert.ok(
    inicioHtml.includes('inicio-update-download'),
    'inicio download CTA'
  );

  section('nginx CORS for remote manifest from shells');
  const nginx = fs.readFileSync(path.join(FRONTEND, 'nginx.conf'), 'utf8');
  assert.ok(
    nginx.includes('Access-Control-Allow-Origin'),
    'nginx CORS on /downloads'
  );

  section('Electron openExternal bridge for manual download');
  const preload = fs.readFileSync(
    path.join(FRONTEND, 'electron/preload.js'),
    'utf8'
  );
  const mainJs = fs.readFileSync(path.join(FRONTEND, 'electron/main.js'), 'utf8');
  assert.ok(preload.includes('openExternal'), 'preload exposes openExternal');
  assert.ok(preload.includes('platform'), 'preload exposes platform');
  assert.ok(mainJs.includes('dv:open-external'), 'main handles open-external');
  assert.ok(mainJs.includes('openExternal'), 'main calls shell.openExternal');

  section('collect script still writes versioned remote manifest');
  const collect = fs.readFileSync(
    path.join(ROOT, 'scripts/package-collect-downloads.sh'),
    'utf8'
  );
  assert.ok(collect.includes('manifest.json'), 'collect writes manifest');
  assert.ok(collect.includes('version'), 'collect includes version');

  console.log('\nAll app-update logic tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
