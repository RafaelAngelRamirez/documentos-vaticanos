/**
 * Daily notification prefs.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/notifications/notification-prefs.logic.test.js
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
  const {
    parseDailyNotificationPrefs,
    serializeDailyNotificationPrefs,
    normalizeNotifTime,
    isLectioDivinaCombo,
    hasAnyDailyChannel,
    scheduledAt,
    DEFAULT_DAILY_NOTIFICATION_PREFS,
  } = await import(
    pathToFileURL(path.join(__dirname, 'notification-prefs.logic.ts')).href
  );

  assert.strictEqual(normalizeNotifTime('7:05'), '07:05');
  assert.strictEqual(normalizeNotifTime('nope'), '07:00');
  const parsed = parseDailyNotificationPrefs(
    '{"enabled":true,"time":"06:30","saint":true,"reading":true,"reflection":true}',
  );
  assert.strictEqual(parsed.time, '06:30');
  assert.ok(isLectioDivinaCombo(parsed));
  assert.ok(hasAnyDailyChannel(parsed));
  assert.ok(!isLectioDivinaCombo(DEFAULT_DAILY_NOTIFICATION_PREFS));
  const round = parseDailyNotificationPrefs(
    serializeDailyNotificationPrefs(parsed),
  );
  assert.deepStrictEqual(round, parsed);

  const now = new Date(2026, 8, 11, 8, 0, 0);
  const day = new Date(2026, 8, 11);
  assert.strictEqual(scheduledAt(day, '07:00', now), null);
  const later = scheduledAt(day, '09:00', now);
  assert.ok(later && later.getHours() === 9);

  console.log('ok notification-prefs.logic');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
