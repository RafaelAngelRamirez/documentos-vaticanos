/**
 * Unit + structural tests for reader chrome stacking (shipped TypeScript).
 * Drives reader-chrome.logic.ts — does NOT reimplement band math.
 *
 * Run:
 *   bash ../scripts/node-strip-types.sh src/app/core/shell/reader-chrome.logic.test.js
 * Monorepo / frontend:
 *   npm run test:safe-area
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FRONTEND = path.resolve(HERE, '../../../..');
const LOGIC_TS = path.join(HERE, 'reader-chrome.logic.ts');
const SAFE_TS = path.join(HERE, 'safe-area.logic.ts');
const STYLES_CSS = path.join(FRONTEND, 'src/styles.css');
const LECTOR_CSS = path.join(
  FRONTEND,
  'src/app/components/lector/lector.component.css'
);
const LECTOR_HTML = path.join(
  FRONTEND,
  'src/app/components/lector/lector.component.html'
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  const mod = await import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
  return mod;
}

async function main() {
  section('shipped modules exist');
  assert.ok(fs.existsSync(LOGIC_TS), 'reader-chrome.logic.ts');
  assert.ok(fs.existsSync(SAFE_TS), 'safe-area.logic.ts');
  assert.ok(fs.existsSync(STYLES_CSS), 'styles.css');
  assert.ok(fs.existsSync(LECTOR_CSS), 'lector.component.css');
  assert.ok(fs.existsSync(LECTOR_HTML), 'lector.component.html');

  const {
    READER_CHROME,
    READER_CHROME_CSS_VARS,
    isMobileReaderWidth,
    bandsOverlap,
    readerBottomBands,
    readerBottomStackHeightPx,
    readerContentBottomPadPx,
    readerTopClearancePx,
    readerFeedbackBottomPx,
    readerChromeCssPx,
  } = await loadLogic();

  const mobile = {
    viewportWidthPx: 390,
    bottomInsetPx: 48,
    narrVisible: true,
    rfootVisible: true,
  };

  section('mobile width predicate');
  assert.strictEqual(isMobileReaderWidth(390), true);
  assert.strictEqual(isMobileReaderWidth(1023), true);
  assert.strictEqual(isMobileReaderWidth(1024), false);
  assert.strictEqual(isMobileReaderWidth(1280), false);

  section('mobile + inset: narr and rfoot occupy distinct bands');
  const bands = readerBottomBands(mobile);
  const rfoot = bands.find((b) => b.id === 'rfoot');
  const narr = bands.find((b) => b.id === 'narr');
  assert.ok(rfoot, 'rfoot band present on mobile');
  assert.ok(narr, 'narr band present when narrator visible');
  assert.strictEqual(rfoot.fromBottomPx, 0);
  assert.strictEqual(
    rfoot.toBottomPx,
    READER_CHROME.rfootHeightPx + 48,
    'rfoot box includes system bottom inset'
  );
  assert.strictEqual(
    narr.fromBottomPx,
    rfoot.toBottomPx,
    'narr sits on top of rfoot (shared edge only)'
  );
  assert.strictEqual(
    bandsOverlap(rfoot, narr),
    false,
    'narrator and rfoot must not share pixels'
  );
  assert.ok(
    narr.toBottomPx > narr.fromBottomPx,
    'narr band has positive height'
  );

  section('content clearance ≥ stacked chrome + inset');
  const pad = readerContentBottomPadPx(mobile);
  const stack = readerBottomStackHeightPx(mobile);
  assert.strictEqual(
    stack,
    READER_CHROME.rfootHeightPx + READER_CHROME.narrHeightPx + 48
  );
  assert.ok(
    pad >= stack,
    `content pad ${pad} must cover stack ${stack}`
  );
  assert.ok(
    pad >=
      READER_CHROME.rfootHeightPx +
        READER_CHROME.narrHeightPx +
        48 +
        READER_CHROME.contentBreathingPx,
    'pad includes breathing room above chrome'
  );
  assert.strictEqual(pad, stack + READER_CHROME.contentBreathingPx);

  section('top bar clearance uses top inset');
  assert.strictEqual(
    readerTopClearancePx(0),
    READER_CHROME.topBarHeightPx
  );
  assert.strictEqual(
    readerTopClearancePx(24),
    READER_CHROME.topBarHeightPx + 24
  );
  assert.strictEqual(
    readerTopClearancePx(-4),
    READER_CHROME.topBarHeightPx,
    'negative inset coerced to 0'
  );

  section('desktop: rfoot omitted; narr includes inset; no overlap');
  const desk = readerBottomBands({
    viewportWidthPx: 1280,
    bottomInsetPx: 24,
    narrVisible: true,
  });
  assert.ok(!desk.some((b) => b.id === 'rfoot'), 'no rfoot on desktop width');
  const dNarr = desk.find((b) => b.id === 'narr');
  assert.ok(dNarr);
  assert.strictEqual(dNarr.fromBottomPx, 0);
  assert.strictEqual(
    dNarr.toBottomPx,
    READER_CHROME.narrHeightPx + 24
  );

  section('narr hidden: stack is rfoot + inset only');
  const noNarr = readerBottomBands({
    viewportWidthPx: 390,
    bottomInsetPx: 48,
    narrVisible: false,
    rfootVisible: true,
  });
  assert.strictEqual(noNarr.length, 1);
  assert.strictEqual(noNarr[0].id, 'rfoot');
  assert.ok(
    readerContentBottomPadPx({
      viewportWidthPx: 390,
      bottomInsetPx: 48,
      narrVisible: false,
      rfootVisible: true,
    }) >=
      READER_CHROME.rfootHeightPx + 48
  );

  section('feedback toast sits above the stack');
  const fb = readerFeedbackBottomPx(mobile, 12);
  assert.ok(fb >= stack + 12);
  assert.ok(fb > narr.toBottomPx - 0.001);

  section('CSS tokens match shipped constants');
  const cssMap = readerChromeCssPx();
  const styles = fs.readFileSync(STYLES_CSS, 'utf8');
  const lectorCss = fs.readFileSync(LECTOR_CSS, 'utf8');
  const combined = styles + '\n' + lectorCss;
  for (const [name, value] of Object.entries(cssMap)) {
    assert.ok(
      combined.includes(`${name}: ${value}`) ||
        combined.includes(`${name}:${value}`),
      `CSS must declare ${name}: ${value}`
    );
  }

  section('CSS stacking: no shared bottom:0 for narr + rfoot on mobile');
  assert.ok(
    /bottom:\s*calc\(\s*var\(--reader-rfoot-height\)/.test(lectorCss) ||
      /bottom:\s*calc\(var\(--reader-rfoot-height\)/.test(lectorCss),
    'mobile .narr is stacked above --reader-rfoot-height, not raw bottom:0'
  );
  assert.ok(
    lectorCss.includes('position: fixed') ||
      lectorCss.includes('position:fixed'),
    'reader chrome uses fixed bands'
  );
  assert.ok(
    /padding-bottom:\s*calc\([\s\S]*--reader-narr-height[\s\S]*--reader-rfoot-height/.test(
      lectorCss
    ) ||
      /padding-bottom:\s*calc\([\s\S]*--reader-rfoot-height[\s\S]*--reader-narr-height/.test(
        lectorCss
      ),
    '.reader padding-bottom reserves narr + rfoot'
  );
  assert.ok(
    lectorCss.includes('var(--safe-area-inset-bottom)'),
    'bottom chrome still uses safe-area inset token'
  );
  assert.ok(
    lectorCss.includes('var(--safe-area-inset-top)'),
    'top bar uses safe-area top inset'
  );

  section('markup: compact mobile narr (no duplicate percent vs rfoot)');
  const html = fs.readFileSync(LECTOR_HTML, 'utf8');
  assert.ok(html.includes('has-rfoot'), 'host class has-rfoot');
  assert.ok(html.includes('has-narr'), 'host class has-narr');
  assert.ok(html.includes('narr-meta'), 'narr title wrapped for desktop');
  assert.ok(
    /class="nlabel only-desktop"/.test(html) ||
      /class="nlabel\s+only-desktop"/.test(html),
    'narr percent hidden on mobile (rfoot already shows %)'
  );

  section('desktop hides encapsulated only-mobile fbar/rfoot');
  assert.ok(
    /@media\s*\(min-width:\s*1024px\)[\s\S]*\.fbar\.only-mobile[\s\S]*display:\s*none\s*!important/.test(
      lectorCss
    ),
    'component CSS hides .fbar.only-mobile at desktop (encapsulation)'
  );
  assert.ok(
    /@media\s*\(min-width:\s*1024px\)[\s\S]*\.rfoot\.only-mobile[\s\S]*display:\s*none\s*!important/.test(
      lectorCss
    ),
    'component CSS hides .rfoot.only-mobile at desktop'
  );

  section('play control is a 48px tap target (Grupo 7C)');
  assert.ok(
    /--reader-narr-height:\s*72px/.test(combined) ||
      combined.includes(`${READER_CHROME_CSS_VARS.narrHeight}: 72px`),
    'narr height 72 = 12+48+12'
  );
  assert.ok(
    /\.play\s*\{[^}]*width:\s*48px/.test(styles) ||
      /\.play\{[^}]*width:48px/.test(styles.replace(/\s+/g, '')),
    '.play is 48px wide'
  );

  console.log('\nOK — reader chrome stacking + clearance\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
