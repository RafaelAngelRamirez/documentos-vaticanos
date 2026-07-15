/**
 * Unit + structural tests for safe-area inset logic (shipped TypeScript module)
 * and CSS / Android bridge wiring.
 *
 * Loads the real `safe-area.logic.ts` via Node type stripping — does NOT reimplement.
 *
 * Run:
 *   node --experimental-strip-types src/app/core/shell/safe-area.logic.test.js
 * Monorepo:
 *   npm run test:safe-area  (from frontend/)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FRONTEND = path.resolve(HERE, '../../../..');
const LOGIC_TS = path.join(HERE, 'safe-area.logic.ts');
const SERVICE_TS = path.join(HERE, 'safe-area.service.ts');
const STYLES_CSS = path.join(FRONTEND, 'src/styles.css');
const LECTOR_CSS = path.join(
  FRONTEND,
  'src/app/components/lector/lector.component.css'
);
const SHEET_TS = path.join(
  FRONTEND,
  'src/app/components/dv-sheet/dv-sheet.component.ts'
);
const MAIN_ACTIVITY = path.join(
  FRONTEND,
  'android/app/src/main/java/digital/documentosvaticanos/app/MainActivity.java'
);
const APP_COMPONENT = path.join(FRONTEND, 'src/app/app.component.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  const mod = await import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
  return mod;
}

function mockRoot() {
  const props = {};
  return {
    props,
    style: {
      setProperty(name, value) {
        props[name] = value;
      },
    },
  };
}

async function main() {
  section('shipped modules exist');
  assert.ok(fs.existsSync(LOGIC_TS), 'safe-area.logic.ts');
  assert.ok(fs.existsSync(SERVICE_TS), 'safe-area.service.ts');
  assert.ok(fs.existsSync(STYLES_CSS), 'styles.css');
  assert.ok(fs.existsSync(MAIN_ACTIVITY), 'MainActivity.java');

  const {
    SAFE_AREA_CSS_VARS,
    normalizeInsetPx,
    insetToCssPx,
    resolveInset,
    resolveInsets,
    applySafeAreaInsets,
    hasBnavPaddingPx,
    buildApplyInsetsJs,
    readBridgeSafeArea,
  } = await loadLogic();

  section('normalizeInsetPx / insetToCssPx');
  assert.strictEqual(normalizeInsetPx(48), 48);
  assert.strictEqual(normalizeInsetPx(48.6), 49);
  assert.strictEqual(normalizeInsetPx(0), 0);
  assert.strictEqual(normalizeInsetPx(-10), 0);
  assert.strictEqual(normalizeInsetPx(null), 0);
  assert.strictEqual(normalizeInsetPx(undefined), 0);
  assert.strictEqual(normalizeInsetPx(NaN), 0);
  assert.strictEqual(insetToCssPx(48), '48px');
  assert.strictEqual(insetToCssPx(0), '0px');

  section('resolveInset prefers non-zero bridge when env is 0 (Android WebView)');
  assert.strictEqual(resolveInset(0, 48), 48);
  assert.strictEqual(resolveInset(34, 0), 34);
  assert.strictEqual(resolveInset(20, 48), 48);
  assert.strictEqual(resolveInset(0, 0), 0);
  assert.strictEqual(resolveInset(null, 24), 24);

  section('resolveInsets / applySafeAreaInsets — non-zero bottom');
  const resolved = resolveInsets({ bottom: 0 }, { bottom: 48, top: 24 });
  assert.strictEqual(resolved.bottom, 48);
  assert.strictEqual(resolved.top, 24);
  const root = mockRoot();
  applySafeAreaInsets(root, resolved);
  assert.strictEqual(
    root.props[SAFE_AREA_CSS_VARS.bottom],
    '48px',
    'bottom CSS var must be non-zero when system nav inset is 48'
  );
  assert.strictEqual(root.props[SAFE_AREA_CSS_VARS.top], '24px');

  section('applySafeAreaInsets — zero inset stays 0px');
  const root0 = mockRoot();
  applySafeAreaInsets(root0, { bottom: 0 });
  assert.strictEqual(root0.props[SAFE_AREA_CSS_VARS.bottom], '0px');

  section('hasBnavPaddingPx = bnav height + system inset');
  assert.strictEqual(hasBnavPaddingPx(96, 0), 96);
  assert.strictEqual(hasBnavPaddingPx(96, 48), 144);
  assert.strictEqual(hasBnavPaddingPx(96, 24), 120);

  section('buildApplyInsetsJs ships real CSS var names + bridge payload');
  const js = buildApplyInsetsJs({ top: 24, right: 0, bottom: 48, left: 0 });
  assert.ok(js.includes("--safe-area-inset-bottom','48px'"), js);
  assert.ok(js.includes("--safe-area-inset-top','24px'"), js);
  assert.ok(js.includes('window.__DV_SAFE_AREA__'), js);
  assert.ok(js.includes('bottom:48'), js);
  assert.ok(js.includes('dv-safe-area'), js);

  section('readBridgeSafeArea from window payload');
  assert.strictEqual(readBridgeSafeArea(null), null);
  assert.strictEqual(readBridgeSafeArea({}), null);
  const fromWin = readBridgeSafeArea({
    __DV_SAFE_AREA__: { bottom: 48, top: 12 },
  });
  assert.deepStrictEqual(fromWin, {
    top: 12,
    right: 0,
    bottom: 48,
    left: 0,
  });

  section('styles.css uses shared --safe-area-inset-bottom token');
  const css = fs.readFileSync(STYLES_CSS, 'utf8');
  assert.ok(
    css.includes('--safe-area-inset-bottom: env(safe-area-inset-bottom'),
    'root token from env()'
  );
  assert.ok(
    css.includes('--bnav-height: 96px'),
    'bnav height token for content clearance'
  );
  assert.ok(
    /app-bnav\s+\.bnav[\s\S]*?padding-bottom:\s*var\(--safe-area-inset-bottom\)/.test(
      css
    ),
    'bnav padding-bottom uses CSS var (not bare bottom:0 without inset)'
  );
  assert.ok(
    css.includes(
      'padding-bottom:calc(var(--bnav-height) + var(--safe-area-inset-bottom))'
    ) ||
      css.includes(
        'padding-bottom: calc(var(--bnav-height) + var(--safe-area-inset-bottom))'
      ),
    '.has-bnav reserves bnav + system inset'
  );
  assert.ok(
    css.includes('bottom:calc(24px + var(--safe-area-inset-bottom))') ||
      css.includes('bottom: calc(24px + var(--safe-area-inset-bottom))'),
    'exit toast uses bottom inset var'
  );
  assert.ok(
    /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?app-bnav\s*\{\s*display:\s*none/.test(
      css
    ),
    'desktop hides bnav'
  );

  section('peer fixed-bottom UIs use the same token');
  const lectorCss = fs.readFileSync(LECTOR_CSS, 'utf8');
  assert.ok(
    lectorCss.includes('var(--safe-area-inset-bottom)'),
    'lector rfoot/selfeedback'
  );
  const sheetTs = fs.readFileSync(SHEET_TS, 'utf8');
  assert.ok(
    sheetTs.includes('var(--safe-area-inset-bottom)'),
    'dv-sheet padding-bottom'
  );

  section('Android MainActivity publishes bottom inset bridge');
  const java = fs.readFileSync(MAIN_ACTIVITY, 'utf8');
  assert.ok(
    java.includes('WindowCompat.setDecorFitsSystemWindows'),
    'edge-to-edge policy'
  );
  assert.ok(java.includes('setDecorFitsSystemWindows(getWindow(), false)'));
  assert.ok(
    java.includes('WindowInsetsCompat.Type.systemBars()'),
    'reads system bar insets'
  );
  assert.ok(
    java.includes("--safe-area-inset-bottom'"),
    'injects CSS bottom var'
  );
  assert.ok(java.includes('window.__DV_SAFE_AREA__'), 'bridge payload');
  assert.ok(java.includes('evaluateJavascript'), 'WebView inject path');

  section('AppComponent wires SafeAreaService');
  const appTs = fs.readFileSync(APP_COMPONENT, 'utf8');
  assert.ok(appTs.includes('SafeAreaService'));
  assert.ok(appTs.includes('safeArea.init()'));

  console.log('\nOK — safe-area logic + structural wiring\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
