/**
 * Long-document scroll: the reading unit only moves forward, and a
 * window trim does not yank the viewport back.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/shell/reader-window.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const VIEWPORT = 844;
const HEADER = 96;
const FOOTER = 160;
const LINE = VIEWPORT * 0.35;
const TOTAL = 360;
const STEP = 10;

function heightAt(index) {
  const pattern = [64, 88, 120, 48, 240, 72, 360, 96, 160, 56];
  return pattern[index % pattern.length];
}

function tops(lo, hi) {
  const top = [];
  let y = HEADER;
  for (let i = lo; i < hi; i++) {
    top[i] = y;
    y += heightAt(i);
  }
  return { top, end: y };
}

function firstVisible(scrollY, lo, hi) {
  const { top } = tops(lo, hi);
  for (let i = lo; i < hi; i++) {
    const bottom = top[i] + heightAt(i);
    if (bottom > scrollY && top[i] < scrollY + VIEWPORT) return i;
  }
  return lo;
}

function unitAtLine(scrollY, lo, hi) {
  const { top } = tops(lo, hi);
  const target = scrollY + LINE;
  let chosen = lo;
  for (let i = lo; i < hi; i++) {
    if (top[i] <= target) chosen = i;
  }
  return chosen;
}

function maxScroll(lo, hi) {
  return Math.max(0, tops(lo, hi).end + FOOTER - VIEWPORT);
}

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'reader-window.logic.ts')).href
  );
  const {
    READER_GROW_BURST,
    READER_LOOKAHEAD_PX,
    READER_MAX_RENDERED,
    extendRenderedRange,
    holdUnitForExtend,
    routeFocusAction,
    scrollDeltaToHoldAnchor,
  } = mod;

  assert.strictEqual(scrollDeltaToHoldAnchor(400, 250), -150);
  assert.strictEqual(scrollDeltaToHoldAnchor(100, 100), 0);
  assert.strictEqual(holdUnitForExtend(0), 0);
  assert.strictEqual(holdUnitForExtend(40), 39);

  assert.strictEqual(
    routeFocusAction({
      sameDocument: false,
      routeUnit: 3,
      reportedUnit: 3,
      rendered: true,
    }),
    'load',
  );
  assert.strictEqual(
    routeFocusAction({
      sameDocument: true,
      routeUnit: 30,
      reportedUnit: 30,
      rendered: true,
    }),
    'keep',
  );
  assert.strictEqual(
    routeFocusAction({
      sameDocument: true,
      routeUnit: 100,
      reportedUnit: 30,
      rendered: true,
    }),
    'scroll',
  );
  assert.strictEqual(
    routeFocusAction({
      sameDocument: true,
      routeUnit: 30,
      reportedUnit: 30,
      rendered: false,
    }),
    'scroll',
  );

  // Recenter-on-visible used to drop the units just appended.
  const appended = extendRenderedRange(
    { lo: 0, hi: 28 },
    5000,
    STEP,
    'down',
    READER_MAX_RENDERED,
    holdUnitForExtend(24),
  );
  assert.strictEqual(appended.hi, 38);
  assert.ok(appended.lo <= 24);
  assert.ok(appended.hi > 28);

  const prologueHeld = extendRenderedRange(
    { lo: 0, hi: 28 },
    5000,
    STEP,
    'down',
    READER_MAX_RENDERED,
    holdUnitForExtend(0),
  );
  assert.strictEqual(prologueHeld.lo, 0);
  assert.strictEqual(prologueHeld.hi, 38);

  const upward = extendRenderedRange(
    { lo: 40, hi: 68 },
    5000,
    STEP,
    'up',
    READER_MAX_RENDERED,
    55,
  );
  assert.strictEqual(upward.lo, 30);
  assert.ok(upward.hi > 55);
  assert.ok(upward.hi <= 68);

  // Centering the spied unit would pull a downward read backward.
  // The spy echo is `keep`, so that delta is not applied.
  {
    const lo = 16;
    const hi = 44;
    const { top } = tops(lo, hi);
    const unit = 30;
    const scrollY = top[unit] - LINE;
    const centered = top[unit] + heightAt(unit) / 2 - VIEWPORT / 2;
    assert.ok(
      centered < scrollY - 40,
      `expected a backward center jump, got ${centered} vs ${scrollY}`,
    );
    const before = scrollY;
    const action = routeFocusAction({
      sameDocument: true,
      routeUnit: unit,
      reportedUnit: unit,
      rendered: unit >= lo && unit < hi,
    });
    assert.strictEqual(action, 'keep');
    assert.strictEqual(scrollY, before);
  }

  // Read from point 1 to the end. Short and tall units, mobile viewport.
  let lo = 0;
  let hi = 5;
  let scrollY = 0;
  let reading = 0;
  let reported = null;
  let steps = 0;

  function grow() {
    let burst = 0;
    while (burst < READER_GROW_BURST && hi < TOTAL) {
      const end = tops(lo, hi).end;
      if (end - scrollY > VIEWPORT + READER_LOOKAHEAD_PX) break;
      const visible = firstVisible(scrollY, lo, hi);
      const anchor = unitAtLine(scrollY, lo, hi);
      const topBefore = tops(lo, hi).top[anchor] - scrollY;
      const next = extendRenderedRange(
        { lo, hi },
        TOTAL,
        STEP,
        'down',
        READER_MAX_RENDERED,
        holdUnitForExtend(visible),
      );
      assert.ok(next.hi >= hi, `forward edge ${hi} -> ${next.hi}`);
      assert.ok(next.lo >= lo, `back edge moved down-window ${lo} -> ${next.lo}`);
      assert.ok(next.lo <= anchor, `trimmed the unit on screen ${anchor}`);
      if (next.lo === lo && next.hi === hi) break;
      const after = tops(next.lo, next.hi);
      assert.ok(after.top[anchor] != null, `anchor ${anchor} left the window`);
      const topAfter = after.top[anchor] - scrollY;
      const delta = scrollDeltaToHoldAnchor(topBefore, topAfter);
      scrollY += delta;
      lo = next.lo;
      hi = next.hi;
      const held = tops(lo, hi).top[anchor] - scrollY;
      assert.ok(
        Math.abs(held - topBefore) < 1e-6,
        `viewport jumped ${topBefore} -> ${held}`,
      );
      const now = unitAtLine(scrollY, lo, hi);
      assert.ok(now >= reading, `grow moved reading ${reading} -> ${now}`);
      reading = now;
      burst++;
    }
  }

  grow();
  while (reading < TOTAL - 1 && steps < 8000) {
    const prevReading = reading;
    const prevHi = hi;
    const prevScroll = scrollY;
    const room = maxScroll(lo, hi);
    if (scrollY < room) scrollY = Math.min(room, scrollY + 320);
    reading = unitAtLine(scrollY, lo, hi);
    assert.ok(
      reading >= prevReading,
      `scroll jumped back ${prevReading} -> ${reading} at y=${scrollY}`,
    );
    if (reading !== reported) {
      const y = scrollY;
      const action = routeFocusAction({
        sameDocument: true,
        routeUnit: reading,
        reportedUnit: reading,
        rendered: reading >= lo && reading < hi,
      });
      assert.strictEqual(action, 'keep');
      assert.strictEqual(scrollY, y);
      reported = reading;
    }
    grow();
    reading = unitAtLine(scrollY, lo, hi);
    assert.ok(reading >= prevReading, `grow after scroll jumped ${prevReading} -> ${reading}`);
    if (hi === TOTAL && scrollY >= maxScroll(lo, hi) - 0.5) break;
    if (hi === prevHi && scrollY === prevScroll && reading === prevReading) {
      throw new Error(
        `stuck at unit ${reading} window ${lo}-${hi} scroll ${scrollY}`,
      );
    }
    steps++;
  }

  assert.strictEqual(hi, TOTAL, `window stopped at ${hi}`);
  assert.ok(reading > TOTAL - 40, `reading stopped at ${reading}`);
  assert.ok(steps < 8000);
  const tail = tops(lo, hi);
  const lastTop = tail.top[TOTAL - 1];
  const lastBottom = lastTop + heightAt(TOTAL - 1);
  assert.ok(lastTop != null, 'last unit was trimmed away');
  assert.ok(
    lastBottom > scrollY && lastTop < scrollY + VIEWPORT,
    'last unit never reached the viewport',
  );

  console.log(
    `reader-window.logic: ok (steps ${steps}, window ${lo}-${hi}, unit ${reading})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
