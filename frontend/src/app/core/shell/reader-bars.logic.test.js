/**
 * Bar visibility while scrolling, including a route jump.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/shell/reader-bars.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'reader-bars.logic.ts')).href
  );
  const { barsAfterScroll } = mod;

  const start = { lastScrollY: 0, scrollAccum: 0, barsHidden: false };
  const down = barsAfterScroll(start, {
    y: 80,
    atTop: false,
    atBottom: false,
    uiOpen: false,
    jumpGuardsBars: false,
  });
  assert.strictEqual(down.barsHidden, true);
  assert.strictEqual(down.scrollAccum, 80);
  assert.strictEqual(down.lastScrollY, 80);

  const jump = barsAfterScroll(down, {
    y: 400,
    atTop: false,
    atBottom: false,
    uiOpen: false,
    jumpGuardsBars: true,
  });
  assert.strictEqual(jump.barsHidden, false);
  assert.strictEqual(jump.scrollAccum, 0);
  assert.strictEqual(jump.lastScrollY, 400);

  const stillGuarded = barsAfterScroll(jump, {
    y: 900,
    atTop: false,
    atBottom: false,
    uiOpen: false,
    jumpGuardsBars: true,
  });
  assert.strictEqual(stillGuarded.barsHidden, false);

  const after = barsAfterScroll(
    { lastScrollY: 900, scrollAccum: 0, barsHidden: false },
    {
      y: 940,
      atTop: false,
      atBottom: false,
      uiOpen: false,
      jumpGuardsBars: false,
    },
  );
  assert.strictEqual(after.barsHidden, true);

  const top = barsAfterScroll(after, {
    y: 10,
    atTop: true,
    atBottom: false,
    uiOpen: false,
    jumpGuardsBars: false,
  });
  assert.strictEqual(top.barsHidden, false);
  assert.strictEqual(top.scrollAccum, 0);

  console.log('reader-bars.logic: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});