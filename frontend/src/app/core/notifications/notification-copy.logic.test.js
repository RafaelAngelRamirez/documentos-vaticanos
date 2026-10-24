/**
 * Daily notification copy / planning.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/notifications/notification-copy.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

async function main() {
  const { planDailyNotifications, notificationId } = await import(
    pathToFileURL(path.join(__dirname, 'notification-copy.logic.ts')).href
  );

  const now = new Date(2026, 8, 11, 6, 0, 0);
  const day = {
    date: new Date(2026, 8, 11),
    saintName: 'San Bruno',
    saintId: 'bruno',
    gospelCite: 'Lc 6,39-42',
    reflectionPreview: 'El Evangelio de Lucas…',
  };

  const combo = planDailyNotifications({
    now,
    prefs: {
      enabled: true,
      time: '07:00',
      saint: true,
      reading: true,
      reflection: true,
    },
    days: [day],
  });
  const kinds = combo.map((n) => n.kind).sort();
  assert.deepStrictEqual(kinds, ['lectio', 'saint']);
  const lectio = combo.find((n) => n.kind === 'lectio');
  assert.strictEqual(lectio.path, '/lectio');
  assert.ok(/Lectio divina/.test(lectio.title));
  assert.ok(/Lc 6/.test(lectio.body));
  const saint = combo.find((n) => n.kind === 'saint');
  assert.strictEqual(saint.path, '/santoral/bruno');

  const onlyReading = planDailyNotifications({
    now,
    prefs: {
      enabled: true,
      time: '07:00',
      saint: false,
      reading: true,
      reflection: false,
    },
    days: [day],
  });
  assert.strictEqual(onlyReading.length, 1);
  assert.strictEqual(onlyReading[0].kind, 'reading');

  const off = planDailyNotifications({
    now,
    prefs: {
      enabled: false,
      time: '07:00',
      saint: true,
      reading: true,
      reflection: true,
    },
    days: [day],
  });
  assert.strictEqual(off.length, 0);
  assert.strictEqual(notificationId('saint', 0), 6100);

  console.log('ok notification-copy.logic');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
