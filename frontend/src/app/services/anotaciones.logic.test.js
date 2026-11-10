/**
 * updatedAt ausente en anotaciones locales: reutilizar createdAt.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/services/anotaciones.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const { fillAnotacionUpdatedAt, isoFromCreatedAt } = await import(
    pathToFileURL(path.join(__dirname, 'anotaciones.logic.ts')).href
  );

  const createdMs = Date.UTC(2020, 0, 2, 3, 4, 5);
  const createdIso = new Date(createdMs).toISOString();
  const ahora = '2099-01-01T00:00:00.000Z';
  const now = () => ahora;

  assert.strictEqual(isoFromCreatedAt(createdMs), createdIso);
  assert.strictEqual(isoFromCreatedAt(String(createdMs)), createdIso);
  assert.strictEqual(isoFromCreatedAt(createdIso), createdIso);
  assert.strictEqual(isoFromCreatedAt('no-es-fecha'), null);
  assert.strictEqual(isoFromCreatedAt(undefined), null);
  assert.strictEqual(isoFromCreatedAt(''), null);

  assert.strictEqual(
    fillAnotacionUpdatedAt(createdIso, createdMs, now),
    createdIso,
  );
  assert.strictEqual(fillAnotacionUpdatedAt('', createdMs, now), createdIso);
  assert.strictEqual(fillAnotacionUpdatedAt(undefined, createdMs, now), createdIso);
  assert.strictEqual(fillAnotacionUpdatedAt(undefined, undefined, now), ahora);

  const service = fs.readFileSync(
    path.join(__dirname, 'anotaciones.service.ts'),
    'utf8',
  );
  const load = service.slice(service.indexOf('private load('));
  assert.ok(load.includes('fillAnotacionUpdatedAt(a.updatedAt, a.createdAt)'));
  assert.ok(!load.includes('new Date()'));
  assert.ok(!load.includes('const ahora'));

  console.log('anotaciones-stamp ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
