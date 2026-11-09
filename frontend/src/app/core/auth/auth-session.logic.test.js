/**
 * Session end on GET /me.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/auth/auth-session.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const { meFailureStatus, sessionEndsOnMeFailure } = await import(
    pathToFileURL(path.join(__dirname, 'auth-session.logic.ts')).href
  );

  assert.strictEqual(meFailureStatus(undefined), 0);
  assert.strictEqual(meFailureStatus(new Error('offline')), 0);
  assert.strictEqual(meFailureStatus({ status: 0 }), 0);
  assert.strictEqual(meFailureStatus({ status: 401 }), 401);
  assert.strictEqual(meFailureStatus({ status: 500 }), 500);
  assert.strictEqual(meFailureStatus({ status: 401.5 }), 0);
  assert.strictEqual(meFailureStatus({ status: '401' }), 0);

  assert.strictEqual(sessionEndsOnMeFailure(401), true);
  assert.strictEqual(sessionEndsOnMeFailure(0), false);
  assert.strictEqual(sessionEndsOnMeFailure(403), false);
  assert.strictEqual(sessionEndsOnMeFailure(500), false);

  const service = fs.readFileSync(path.join(__dirname, 'auth.service.ts'), 'utf8');
  const refresh = service.slice(
    service.indexOf('refreshMe('),
    service.indexOf('upgradeToTeacher('),
  );
  assert.ok(refresh.includes('sessionEndsOnMeFailure(meFailureStatus(err))'));
  assert.ok(!/catchError\(\(\) =>/.test(refresh));
  assert.strictEqual(refresh.split('this.logout()').length - 1, 1);

  console.log('auth-session ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
