/**
 * Immersive chrome predicate used by PagesComponent.
 * Run: bash ../scripts/node-strip-types.sh src/app/pages/immersive-route.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'immersive-route.logic.ts')).href
  );
  const { isImmersivePath, pathFromUrl } = mod;

  assert.strictEqual(pathFromUrl('/buscar?q=fe#top'), '/buscar');

  const yes = [
    '/',
    '',
    '/inicio',
    '/inicio?x=1',
    '/biblioteca',
    '/biblioteca?tab=1',
    '/documentos/listar',
    '/buscar',
    '/buscar?q=amor',
    '/leyendo',
    '/leyendo/cic-es/punto/27',
  ];
  for (const url of yes) {
    assert.strictEqual(isImmersivePath(url), true, url);
  }

  const no = [
    '/estudio',
    '/estudios',
    '/explorar',
    '/explorar/topicos/gracia',
    '/cuenta',
    '/ajustes',
    '/padres',
    '/padres/agustin-hipona',
    '/doctores/agustin-hipona',
    '/santoral',
    '/santoral/agustin-hipona',
    '/documento/cic-es',
    '/aprendizaje',
    '/admin/revision',
  ];
  for (const url of no) {
    assert.strictEqual(isImmersivePath(url), false, url);
  }

  console.log('immersive-route.logic.test.js: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
