/**
 * Tests de preferencias del narrador por dispositivo (shipped logic).
 * Run: node --experimental-strip-types src/app/services/narrator-prefs.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'narrator-prefs.logic.ts');
const SERVICE = path.join(HERE, 'narrator-preferences.service.ts');
const NARRATOR = path.join(HERE, 'narrator.service.ts');
const AJUSTES = path.resolve(HERE, '../pages/ajustes/ajustes.component.html');
const AJUSTES_TS = path.resolve(HERE, '../pages/ajustes/ajustes.component.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC));
  assert.ok(fs.existsSync(SERVICE));
  const svc = fs.readFileSync(NARRATOR, 'utf8');
  assert.ok(svc.includes('narrPrefs.grokEnabled'), 'list/speak respect device pref');
  assert.ok(svc.includes('probeGrokStatus'), 'probe for Ajustes status');
  const html = fs.readFileSync(AJUSTES, 'utf8');
  assert.ok(html.includes('Narrador'), 'Ajustes has Narrador section');
  assert.ok(html.includes('ajustes-grok-toggle'), 'Grok toggle in Ajustes');
  assert.ok(html.includes('este dispositivo') || html.includes('Voces Grok'), 'per-device copy');
  const ajTs = fs.readFileSync(AJUSTES_TS, 'utf8');
  assert.ok(ajTs.includes('NarratorPreferencesService'));
  assert.ok(ajTs.includes('toggleGrokEnabled'));

  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const {
    parseNarratorDevicePrefs,
    serializeNarratorDevicePrefs,
    shouldFetchGrokVoices,
    grokStatusLabel,
    DEFAULT_NARRATOR_DEVICE_PREFS,
    NARRATOR_PREFS_STORAGE_KEY,
  } = mod;

  section('defaults + parse');
  assert.strictEqual(DEFAULT_NARRATOR_DEVICE_PREFS.grokEnabled, true);
  assert.strictEqual(parseNarratorDevicePrefs(null).grokEnabled, true);
  assert.strictEqual(parseNarratorDevicePrefs(null).voiceId, null);
  assert.strictEqual(
    parseNarratorDevicePrefs(null, 'grok:eve').voiceId,
    'grok:eve',
    'legacy voice migration',
  );
  const parsed = parseNarratorDevicePrefs(
    JSON.stringify({ grokEnabled: false, voiceId: 'es-ES#0' }),
  );
  assert.strictEqual(parsed.grokEnabled, false);
  assert.strictEqual(parsed.voiceId, 'es-ES#0');

  section('serialize round-trip');
  const ser = serializeNarratorDevicePrefs({
    grokEnabled: true,
    voiceId: 'grok:ara',
  });
  const back = parseNarratorDevicePrefs(ser);
  assert.strictEqual(back.grokEnabled, true);
  assert.strictEqual(back.voiceId, 'grok:ara');
  assert.ok(NARRATOR_PREFS_STORAGE_KEY.startsWith('dv.narr'));

  section('shouldFetchGrokVoices per device');
  assert.strictEqual(shouldFetchGrokVoices({ grokEnabled: true }), true);
  assert.strictEqual(shouldFetchGrokVoices({ grokEnabled: false }), false);

  section('status labels');
  assert.ok(grokStatusLabel('available').length > 0);
  assert.ok(grokStatusLabel('disabled').toLowerCase().includes('desactiv'));

  console.log('\nAll narrator-prefs.logic tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
