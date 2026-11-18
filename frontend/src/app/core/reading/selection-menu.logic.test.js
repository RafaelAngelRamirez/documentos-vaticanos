/**
 * Selection menu vs native Chrome Android ActionMode.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/reading/selection-menu.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'selection-menu.logic.ts')).href
  );
  const {
    shouldClearNativeSelectionMenu,
    selectionPopoverPosition,
    clipSelectionExcerpt,
    keepSelectionPopoverOnCollapse,
  } = mod;

  assert.strictEqual(
    shouldClearNativeSelectionMenu({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      pointerCoarse: false,
      hoverNone: false,
      isNativePlatform: false,
    }),
    true,
  );

  assert.strictEqual(
    shouldClearNativeSelectionMenu({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      pointerCoarse: false,
      hoverNone: false,
      isNativePlatform: false,
    }),
    false,
  );

  assert.strictEqual(
    shouldClearNativeSelectionMenu({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      pointerCoarse: true,
      hoverNone: false,
      isNativePlatform: false,
    }),
    true,
  );

  assert.strictEqual(
    shouldClearNativeSelectionMenu({
      userAgent: 'Mozilla/5.0',
      pointerCoarse: false,
      hoverNone: false,
      isNativePlatform: true,
    }),
    true,
  );

  assert.strictEqual(
    shouldClearNativeSelectionMenu({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      pointerCoarse: false,
      hoverNone: false,
      isNativePlatform: false,
    }),
    true,
  );

  const pos = selectionPopoverPosition({ top: 120, left: 40, width: 200 }, 390);
  assert.strictEqual(pos.top, 110);
  assert.strictEqual(pos.left, 140);

  assert.strictEqual(clipSelectionExcerpt('  ab  '), 'ab');
  assert.strictEqual(clipSelectionExcerpt('x'.repeat(280)).length, 280);
  const clipped = clipSelectionExcerpt('x'.repeat(281));
  assert.ok(clipped.endsWith('…'));
  assert.strictEqual(clipped.length, 278);

  assert.strictEqual(
    keepSelectionPopoverOnCollapse({
      notaOpen: true,
      holdingClearedSelection: false,
      selectionCollapsed: true,
    }),
    'ignore',
  );
  assert.strictEqual(
    keepSelectionPopoverOnCollapse({
      notaOpen: false,
      holdingClearedSelection: true,
      selectionCollapsed: true,
    }),
    'ignore',
  );
  assert.strictEqual(
    keepSelectionPopoverOnCollapse({
      notaOpen: false,
      holdingClearedSelection: false,
      selectionCollapsed: true,
    }),
    'dismiss',
  );
  assert.strictEqual(
    keepSelectionPopoverOnCollapse({
      notaOpen: false,
      holdingClearedSelection: false,
      selectionCollapsed: false,
    }),
    'evaluate',
  );

  console.log('selection-menu.logic: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
