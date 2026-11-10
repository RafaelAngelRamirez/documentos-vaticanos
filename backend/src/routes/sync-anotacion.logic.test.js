/**
 * updatedAt de anotaciones en el merge: createdAt si falta, y el empate
 * no descarta el texto del dispositivo.
 * Run from backend/:
 *   bash ../scripts/node-strip-types.sh src/routes/sync-anotacion.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function row(over) {
  return {
    id: 'n1',
    documentId: 'cic-es',
    unitIndex: 2,
    unitLabel: null,
    excerpt: 'texto',
    nota: null,
    kind: 'subrayado',
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...over,
  };
}

async function main() {
  const { anotacionMergeAction, anotacionMergePlan, resolveAnotacionStamp } =
    await import(pathToFileURL(path.join(__dirname, 'sync-anotacion.logic.ts')).href);

  const created = new Date('2020-01-02T03:04:05.000Z');
  const edited = new Date('2024-06-01T00:00:00.000Z');
  assert.strictEqual(resolveAnotacionStamp(edited, created), edited);
  assert.strictEqual(resolveAnotacionStamp(null, created), created);
  assert.strictEqual(resolveAnotacionStamp(new Date('nope'), created), created);
  assert.strictEqual(resolveAnotacionStamp(null, null), null);

  const cloud = row({});
  assert.strictEqual(anotacionMergeAction(cloud, null), 'create');
  assert.strictEqual(
    anotacionMergeAction(row({ updatedAt: new Date('2024-02-01T00:00:00.000Z') }), cloud),
    'update',
  );
  assert.strictEqual(
    anotacionMergeAction(row({ updatedAt: new Date('2023-01-01T00:00:00.000Z') }), cloud),
    'keep',
  );
  assert.strictEqual(anotacionMergeAction(cloud, cloud), 'keep');
  assert.strictEqual(
    anotacionMergeAction(row({ nota: 'del teléfono' }), cloud),
    'update',
  );
  assert.strictEqual(
    anotacionMergeAction(row({ excerpt: 'otro fragmento' }), cloud),
    'update',
  );
  assert.strictEqual(
    anotacionMergeAction(row({ updatedAt: new Date(NaN) }), cloud),
    'keep',
  );

  const fresh = row({ id: 'nueva', excerpt: 'local' });
  const tied = row({ nota: 'dispositivo' });
  const older = row({
    id: 'vieja',
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    excerpt: 'no pisa',
  });
  const plan = anotacionMergePlan(
    [fresh, tied, older, row({ id: 'nueva', excerpt: 'más nueva', updatedAt: edited })],
    [cloud, row({ id: 'vieja', excerpt: 'nube' })],
  );
  assert.deepStrictEqual(
    plan.create.map((item) => item.id),
    ['nueva'],
  );
  assert.strictEqual(plan.create[0].excerpt, 'más nueva');
  assert.deepStrictEqual(
    plan.update.map((item) => [item.id, item.nota]),
    [['n1', 'dispositivo']],
  );

  const sync = fs.readFileSync(path.join(__dirname, 'sync.ts'), 'utf8');
  const anots = sync.slice(sync.indexOf('Anotaciones:'), sync.indexOf('Temas:'));
  assert.ok(sync.includes('resolveAnotacionStamp('));
  assert.ok(sync.includes('anotacionMergePlan('));
  assert.ok(sync.includes('prisma.anotacion.createMany('));
  assert.ok(sync.includes('prisma.$transaction('));
  assert.ok(sync.includes('planThemeMerges('));
  assert.ok(sync.includes("decision.action === 'mint'"));
  assert.ok(!anots.includes('prevUpdatedAt'));
  assert.ok(!anots.includes('Igual o más antigua que la nube'));
  assert.ok(!sync.includes('await prisma.anotacion.create('));
  assert.ok(!sync.includes('await prisma.anotacion.update('));
  assert.ok(!sync.includes('findFirst'));
  assert.ok(!sync.includes('ownerId: userId, title'));

  console.log('sync-anotacion ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
