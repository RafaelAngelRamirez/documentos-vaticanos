/**
 * Unit tests for shipped version-display.logic.ts (no reimplementation).
 * Run:
 *   node --experimental-strip-types frontend/src/app/core/downloads/version-display.logic.test.js
 * Monorepo:
 *   npm run test:version-display
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FRONTEND = path.resolve(HERE, '../../../..');
const ROOT = path.resolve(FRONTEND, '..');
const LOGIC_TS = path.join(HERE, 'version-display.logic.ts');
const INICIO_TS = path.join(
  FRONTEND,
  'src/app/pages/inicio/inicio.component.ts'
);
const DOWNLOADS_SVC = path.join(HERE, 'downloads.service.ts');
const ENV_TS = path.join(FRONTEND, 'src/environments/environment.ts');
const ENV_PROD_TS = path.join(
  FRONTEND,
  'src/environments/environment.prod.ts'
);
const ASSETS_MANIFEST = path.join(
  FRONTEND,
  'src/assets/downloads/manifest.json'
);
const PACKAGE_JSON = path.join(ROOT, 'package.json');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).version;
}

function readEnvironmentVersion(filePath) {
  const body = fs.readFileSync(filePath, 'utf8');
  const m = body.match(/version:\s*['"]([^'"]+)['"]/);
  assert.ok(m, `version field in ${path.relative(ROOT, filePath)}`);
  return m[1];
}

async function loadLogic() {
  const mod = await import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
  return mod;
}

async function main() {
  section('shipped module exists');
  assert.ok(fs.existsSync(LOGIC_TS), 'version-display.logic.ts');

  const {
    pickAppVersionForDisplay,
    parseVersionCore,
    compareVersionCore,
  } = await loadLogic();

  section('parseVersionCore / compareVersionCore');
  assert.deepStrictEqual(parseVersionCore('0.0.16'), [0, 0, 16]);
  assert.deepStrictEqual(parseVersionCore('v1.2.3'), [1, 2, 3]);
  assert.strictEqual(parseVersionCore(''), null);
  assert.strictEqual(parseVersionCore('not-semver'), null);
  assert.ok(compareVersionCore('0.0.13', '0.0.16') < 0);
  assert.strictEqual(compareVersionCore('1.0.0', '1.0.0'), 0);

  section('pickAppVersionForDisplay prefers build over lagging stub');
  assert.strictEqual(
    pickAppVersionForDisplay('0.0.16', '0.0.13'),
    '0.0.16',
    'build wins over older assets/downloads stub (APK regression)'
  );
  assert.strictEqual(
    pickAppVersionForDisplay('0.0.16', '0.0.16'),
    '0.0.16'
  );
  assert.strictEqual(
    pickAppVersionForDisplay('v0.0.20', '0.0.13'),
    '0.0.20',
    'strips leading v from build'
  );
  assert.strictEqual(
    pickAppVersionForDisplay('', '1.2.3'),
    '1.2.3',
    'manifest fallback only when build missing'
  );
  assert.strictEqual(
    pickAppVersionForDisplay(null, '2.0.0'),
    '2.0.0'
  );
  assert.strictEqual(pickAppVersionForDisplay('', ''), '');

  section('repo versions aligned (package = environment = assets stub)');
  const pkgVer = readPackageVersion();
  const envVer = readEnvironmentVersion(ENV_TS);
  const envProdVer = readEnvironmentVersion(ENV_PROD_TS);
  assert.strictEqual(envVer, pkgVer, 'environment.ts matches package.json');
  assert.strictEqual(
    envProdVer,
    pkgVer,
    'environment.prod.ts matches package.json'
  );
  const stub = JSON.parse(fs.readFileSync(ASSETS_MANIFEST, 'utf8'));
  assert.strictEqual(
    stub.version,
    pkgVer,
    'assets/downloads/manifest.json must track package version (no lag)'
  );

  section('Inicio does not clobber versionLabel from downloads manifest');
  const inicioBody = fs.readFileSync(INICIO_TS, 'utf8');
  assert.ok(
    inicioBody.includes('resolveAppVersionLabel') ||
      inicioBody.includes('pickAppVersionForDisplay'),
    'inicio uses build-version resolver'
  );
  assert.ok(
    inicioBody.includes('environment.version'),
    'inicio references environment.version'
  );
  // Must not assign versionLabel from links.version alone
  assert.ok(
    !/versionLabel\s*=\s*formatVersionLabel\(\s*links\.version/.test(
      inicioBody
    ),
    'inicio must not set versionLabel from links.version alone'
  );

  section('DownloadsService uses pickAppVersionForDisplay');
  const svcBody = fs.readFileSync(DOWNLOADS_SVC, 'utf8');
  assert.ok(
    svcBody.includes('pickAppVersionForDisplay'),
    'downloads.service uses pickAppVersionForDisplay'
  );
  assert.ok(
    svcBody.includes('environment.version'),
    'downloads.service reads environment.version'
  );

  section('standard-version bumps assets downloads manifest');
  const versionrc = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.versionrc'), 'utf8')
  );
  const bumped = (versionrc.bumpFiles || []).some(
    (f) =>
      f.filename === 'frontend/src/assets/downloads/manifest.json' ||
      f.filename === 'src/assets/downloads/manifest.json'
  );
  assert.ok(
    bumped,
    'assets/downloads/manifest.json is in .versionrc bumpFiles'
  );

  // Drive the real pure function with the live package version (not hard-coded).
  section('live package version drives display helper');
  const display = pickAppVersionForDisplay(pkgVer, '0.0.1');
  assert.strictEqual(
    display,
    pkgVer,
    `display for package ${pkgVer} must ignore stale 0.0.1 stub`
  );
  assert.notStrictEqual(display, '0.0.1');

  console.log('\nAll version-display tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
