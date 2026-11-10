/**
 * Identidad de un tema en el merge: solo el id.
 * Run from backend/:
 *   bash ../scripts/node-strip-types.sh src/routes/sync-theme.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const { themeDeviceId, themeMergeAction, signedCreateThenMerge, planThemeMerges } =
    await import(pathToFileURL(path.join(__dirname, 'sync-theme.logic.ts')).href);

  const owner = 'user-1';
  const other = 'user-2';

  assert.deepStrictEqual(
    themeMergeAction('tema-local', { id: 'tema-local', ownerId: owner }, owner),
    { action: 'update', id: 'tema-local' },
  );

  assert.deepStrictEqual(
    themeMergeAction('tema-local', null, owner),
    { action: 'create', id: 'tema-local' },
  );

  assert.deepStrictEqual(
    themeMergeAction('tema-local', { id: 'tema-local', ownerId: other }, owner),
    { action: 'mint' },
  );

  assert.deepStrictEqual(themeMergeAction(null, null, owner), { action: 'mint' });
  assert.deepStrictEqual(themeMergeAction('', null, owner), { action: 'mint' });

  assert.deepStrictEqual(
    themeMergeAction('tema-b', { id: 'tema-a', ownerId: owner }, owner),
    { action: 'create', id: 'tema-b' },
  );

  assert.strictEqual(themeDeviceId(undefined), null);
  assert.strictEqual(themeDeviceId(''), null);
  assert.strictEqual(themeDeviceId('  '), null);
  assert.strictEqual(themeDeviceId(' device-1 '), 'device-1');

  const roundTrip = signedCreateThenMerge('device-1', owner);
  assert.strictEqual(roundTrip.cloudId, 'device-1');
  assert.deepStrictEqual(roundTrip.merge, { action: 'update', id: 'device-1' });
  assert.notStrictEqual(roundTrip.merge.action, 'create');

  const mine = { id: 'server-1', ownerId: owner };
  const foreign = { id: 'device-1', ownerId: other };
  assert.deepStrictEqual(
    planThemeMerges(owner, ['device-1'], ['server-1'], [null]),
    [{ action: 'update', id: 'server-1' }],
  );
  assert.deepStrictEqual(
    planThemeMerges(owner, ['device-1'], ['server-1'], [foreign]),
    [{ action: 'update', id: 'server-1' }],
  );
  assert.deepStrictEqual(
    planThemeMerges(owner, ['server-1'], ['server-1'], [mine]),
    [{ action: 'update', id: 'server-1' }],
  );
  assert.deepStrictEqual(planThemeMerges(owner, ['device-1'], [], [foreign]), [
    { action: 'mint' },
  ]);
  assert.deepStrictEqual(planThemeMerges(owner, ['device-1'], [], [null]), [
    { action: 'create', id: 'device-1' },
  ]);
  assert.deepStrictEqual(
    planThemeMerges(owner, ['device-1', 'device-2'], ['server-1'], [null, null]),
    [
      { action: 'create', id: 'device-1' },
      { action: 'create', id: 'device-2' },
    ],
  );
  assert.deepStrictEqual(
    planThemeMerges(owner, ['device-1', 'device-2'], ['server-1'], [foreign, null]),
    [
      { action: 'mint' },
      { action: 'create', id: 'device-2' },
    ],
  );

  const logic = fs.readFileSync(path.join(__dirname, 'sync-theme.logic.ts'), 'utf8');
  assert.ok(!/\btitle\b/.test(logic));

  const sync = fs.readFileSync(path.join(__dirname, 'sync.ts'), 'utf8');
  assert.ok(sync.includes('planThemeMerges('));
  assert.ok(sync.includes('id: decision.id'));
  assert.ok(sync.includes("decision.action === 'mint'"));
  assert.ok(!sync.includes('findFirst'));
  assert.ok(!sync.includes('id: null'));
  assert.ok(!sync.includes('ownerId: userId, title'));
  assert.ok(!sync.includes('clave natural'));

  const themesRoute = fs.readFileSync(path.join(__dirname, 'themes.ts'), 'utf8');
  const post = themesRoute.slice(
    themesRoute.indexOf('/** POST /api/v1/me/themes */'),
    themesRoute.indexOf('/** PATCH /api/v1/me/themes/:id */'),
  );
  assert.ok(post.includes('themeMergeAction('));
  assert.ok(post.includes('themeDeviceId('));
  assert.ok(post.includes("error: 'id is required'"));
  assert.ok(post.indexOf("error: 'id is required'") < post.indexOf('prisma.theme.create'));
  assert.ok(post.includes('id: decision.id'));
  assert.ok(post.includes("decision.action === 'mint'"));
  assert.ok(post.includes("decision.action === 'update'"));
  assert.ok(!/where:\s*\{[^}]*title/.test(post));

  const service = fs.readFileSync(
    path.join(__dirname, '../../../frontend/src/app/core/account/themes.service.ts'),
    'utf8',
  );
  const createFn = service.slice(service.indexOf('create(input:'), service.indexOf('update('));
  assert.ok(createFn.includes('id: theme.id'));
  assert.ok(createFn.includes('adoptServerThemeId(theme.id, res?.item?.id)'));
  assert.ok(!createFn.includes('/me/themes`, input)'));

  console.log('sync-theme ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
