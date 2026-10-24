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
const BACKUP = path.join(HERE, 'backup.service.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  const LECTOR = path.resolve(HERE, '../components/lector/lector.component.ts');
  const HIST = path.resolve(
    HERE,
    '../components/historical-context-block/historical-context-block.component.ts',
  );

  section('artifacts');
  assert.ok(fs.existsSync(LOGIC));
  assert.ok(fs.existsSync(SERVICE));
  const svc = fs.readFileSync(NARRATOR, 'utf8');
  assert.ok(svc.includes('narrPrefs.grokEnabled'), 'list/speak respect device pref');
  assert.ok(svc.includes('xaiApiKey') || svc.includes('xaiAuthHeaders'), 'uses device API key');
  assert.ok(svc.includes('api.x.ai') || svc.includes('xaiTts'), 'calls xAI from client');
  assert.ok(svc.includes('probeGrokStatus'), 'probe for Ajustes status');
  const html = fs.readFileSync(AJUSTES, 'utf8');
  assert.ok(html.includes('Narrador'), 'Ajustes has Narrador section');
  assert.ok(html.includes('ajustes-xai-key'), 'API key field in Ajustes');
  assert.ok(html.includes('ajustes-xai-save'), 'save key button');
  assert.ok(html.includes('este dispositivo'), 'per-device copy');
  const ajTs = fs.readFileSync(AJUSTES_TS, 'utf8');
  assert.ok(ajTs.includes('saveXaiApiKey'));
  assert.ok(ajTs.includes('clearXaiApiKey'));
  assert.ok(ajTs.includes('resolvePreferredVoice'), 'Ajustes uses global voice resolve');
  assert.ok(ajTs.includes('cycleNarrVoice'), 'Ajustes voice selector');
  // Must not rewrite voiceId when catalog misses the saved voice.
  assert.ok(
    !/if\s*\(\s*this\.narrVoice\s*&&\s*this\.narrVoice\.id\s*!==\s*saved\s*\)\s*\{\s*this\.narratorPrefs\.setVoiceId/.test(
      ajTs.replace(/\s+/g, ' '),
    ),
    'Ajustes must not overwrite voiceId on incomplete catalog',
  );
  const lectorSrc = fs.readFileSync(LECTOR, 'utf8');
  assert.ok(lectorSrc.includes('resolvePreferredVoice'), 'lector resolves global voice');
  assert.ok(lectorSrc.includes('applyGlobalVoice'), 'lector re-applies voice on speak');
  assert.ok(lectorSrc.includes('setVoiceId'), 'cycleVoice persists global voiceId');
  assert.ok(lectorSrc.includes('startNarratorFrom'), 'start waits/resolves global voice');
  assert.ok(
    lectorSrc.includes('narrPrefs.voiceId') || lectorSrc.includes('this.narrPrefs.voiceId'),
    'lector reads global voiceId',
  );
  const histSrc = fs.readFileSync(HIST, 'utf8');
  assert.ok(histSrc.includes('resolvePreferredVoice'), 'historical context uses global voice');
  assert.ok(histSrc.includes('narrPrefs.voiceId') || histSrc.includes('this.narrPrefs.voiceId'));
  const backup = fs.readFileSync(BACKUP, 'utf8');
  assert.ok(backup.includes('narratorPrefsForBackup'), 'backup strips key');
  const logicSrc = fs.readFileSync(LOGIC, 'utf8');
  assert.ok(logicSrc.includes('export function resolvePreferredVoice'));

  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const {
    parseNarratorDevicePrefs,
    serializeNarratorDevicePrefs,
    shouldFetchGrokVoices,
    resolvePreferredVoice,
    grokStatusLabel,
    normalizeXaiApiKey,
    hasXaiApiKey,
    narratorPrefsForBackup,
    maskXaiApiKey,
    DEFAULT_NARRATOR_DEVICE_PREFS,
    NARRATOR_PREFS_STORAGE_KEY,
  } = mod;

  section('defaults + parse + xaiApiKey');
  assert.strictEqual(DEFAULT_NARRATOR_DEVICE_PREFS.grokEnabled, true);
  assert.strictEqual(DEFAULT_NARRATOR_DEVICE_PREFS.xaiApiKey, null);
  assert.strictEqual(parseNarratorDevicePrefs(null).voiceId, null);
  assert.strictEqual(
    parseNarratorDevicePrefs(null, 'grok:eve').voiceId,
    'grok:eve',
    'legacy voice migration',
  );
  const parsed = parseNarratorDevicePrefs(
    JSON.stringify({
      grokEnabled: true,
      voiceId: 'es-ES#0',
      xaiApiKey: 'Bearer xai-secret-key-12345',
    }),
  );
  assert.strictEqual(parsed.grokEnabled, true);
  assert.strictEqual(parsed.voiceId, 'es-ES#0');
  assert.strictEqual(parsed.xaiApiKey, 'xai-secret-key-12345', 'strips Bearer');
  assert.strictEqual(normalizeXaiApiKey('  xai-ab  '), 'xai-ab');
  assert.strictEqual(hasXaiApiKey({ xaiApiKey: 'xai-1' }), true);
  assert.strictEqual(hasXaiApiKey({ xaiApiKey: null }), false);

  section('serialize round-trip keeps voiceId + key on device prefs');
  const ser = serializeNarratorDevicePrefs({
    grokEnabled: true,
    voiceId: 'grok:ara',
    xaiApiKey: 'xai-local-only',
    readCitationPrefix: true,
  });
  const back = parseNarratorDevicePrefs(ser);
  assert.strictEqual(back.voiceId, 'grok:ara', 'voiceId survives round-trip');
  assert.strictEqual(back.xaiApiKey, 'xai-local-only');
  assert.ok(NARRATOR_PREFS_STORAGE_KEY.startsWith('dv.narr'));

  section('resolvePreferredVoice matches global id; missing does not invent');
  const catalog = [
    { id: 'es-ES#0', name: 'System ES' },
    { id: 'grok:eve', name: 'Eve' },
    { id: 'grok:ara', name: 'Ara' },
  ];
  const matched = resolvePreferredVoice(catalog, 'grok:eve');
  assert.ok(matched);
  assert.strictEqual(matched.id, 'grok:eve');
  assert.strictEqual(matched.name, 'Eve');
  // Incomplete catalog (Grok offline): no match → null; prefs stay untouched.
  const systemOnly = [{ id: 'es-ES#0', name: 'System ES' }];
  const missing = resolvePreferredVoice(systemOnly, 'grok:eve');
  assert.strictEqual(missing, null, 'missing voice must not fall back to first');
  assert.strictEqual(
    resolvePreferredVoice(catalog, null),
    null,
    'null prefs → system default (null voice)',
  );
  assert.strictEqual(resolvePreferredVoice([], 'grok:eve'), null);
  assert.strictEqual(resolvePreferredVoice(null, 'grok:eve'), null);
  // Simulate "Ajustes refresh" policy: keep saved id when resolve is null.
  let savedVoiceId = 'grok:eve';
  const uiVoice = resolvePreferredVoice(systemOnly, savedVoiceId);
  if (uiVoice == null) {
    /* do not: savedVoiceId = systemOnly[0].id */
  }
  assert.strictEqual(
    savedVoiceId,
    'grok:eve',
    'incomplete catalog must not overwrite global voiceId',
  );
  // When catalog recovers, same saved id resolves again.
  assert.strictEqual(
    resolvePreferredVoice(catalog, savedVoiceId)?.id,
    'grok:eve',
  );

  section('shouldFetchGrokVoices requires toggle AND key');
  assert.strictEqual(
    shouldFetchGrokVoices({ grokEnabled: true, xaiApiKey: null }),
    false,
  );
  assert.strictEqual(
    shouldFetchGrokVoices({ grokEnabled: true, xaiApiKey: 'xai-k' }),
    true,
  );
  assert.strictEqual(
    shouldFetchGrokVoices({ grokEnabled: false, xaiApiKey: 'xai-k' }),
    false,
  );

  section('backup omits API key');
  const forBackup = narratorPrefsForBackup({
    grokEnabled: true,
    voiceId: 'grok:eve',
    xaiApiKey: 'xai-must-not-export',
  });
  assert.ok(forBackup);
  assert.strictEqual(forBackup.voiceId, 'grok:eve');
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(forBackup, 'xaiApiKey'),
    false,
    'xaiApiKey never in backup payload',
  );
  assert.ok(maskXaiApiKey('xai-abcdefghijklmnop').includes('…'));

  section('status labels');
  assert.ok(grokStatusLabel('no_key').toLowerCase().includes('falta'));
  assert.ok(grokStatusLabel('available').length > 0);

  console.log('\nAll narrator-prefs.logic tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
