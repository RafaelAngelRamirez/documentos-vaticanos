/**
 * Tests de la lógica shipped del narrador Grok + system.
 * Importa el módulo real; no reimplementa list/speak mapping.
 *
 * Run:
 *   node --experimental-strip-types src/app/services/narrator-grok.logic.test.js
 * Monorepo: npm run test:narrator-grok
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC_TS = path.join(HERE, 'narrator-grok.logic.ts');
const SERVICE_TS = path.join(HERE, 'narrator.service.ts');
const LECTOR_TS = path.resolve(HERE, '../components/lector/lector.component.ts');
const BACKEND_TTS = path.resolve(
  HERE,
  '../../../../backend/src/routes/tts.ts',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  return import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
}

async function main() {
  section('shipped artifacts');
  assert.ok(fs.existsSync(LOGIC_TS), 'narrator-grok.logic.ts');
  assert.ok(fs.existsSync(SERVICE_TS), 'narrator.service.ts');
  const svc = fs.readFileSync(SERVICE_TS, 'utf8');
  assert.ok(svc.includes('isGrokVoice'), 'service uses isGrokVoice');
  assert.ok(svc.includes('speakGrok') || svc.includes('grokSpeakUrl'), 'service has Grok speak path');
  assert.ok(svc.includes('fetchGrokVoices') || svc.includes('grokVoicesUrl'), 'service lists Grok voices');
  assert.ok(svc.includes('apiBaseUrl'), 'service checks apiBaseUrl');
  const lector = fs.readFileSync(LECTOR_TS, 'utf8');
  assert.ok(lector.includes('narrVoicePillLabel'), 'lector uses pill label helper');
  assert.ok(fs.existsSync(BACKEND_TTS), 'backend tts route exists');

  const {
    isGrokVoice,
    grokVoiceIdOf,
    mapGrokApiVoices,
    parseGrokVoicesResponse,
    mergeNarratorVoices,
    grokVoicesUrl,
    grokSpeakUrl,
    buildGrokSpeakBody,
    planGrokRate,
    narrVoicePillLabel,
    GROK_VOICE_ID_PREFIX,
  } = await loadLogic();

  section('isGrokVoice / grokVoiceIdOf');
  assert.strictEqual(isGrokVoice(null), false);
  assert.strictEqual(
    isGrokVoice({ id: 'es-ES#0', name: 'es', lang: 'es-ES', index: 0 }),
    false,
  );
  assert.strictEqual(
    isGrokVoice({
      id: 'grok:eve',
      name: 'Grok · Eve',
      lang: 'es-ES',
      index: -1,
      provider: 'grok',
      grokVoiceId: 'eve',
    }),
    true,
  );
  assert.strictEqual(
    isGrokVoice({ id: 'grok:ara', name: 'x', lang: 'es-ES', index: -1 }),
    true,
  );
  assert.strictEqual(
    grokVoiceIdOf({
      id: 'grok:eve',
      name: 'Grok',
      lang: 'es-ES',
      index: -1,
      grokVoiceId: 'eve',
    }),
    'eve',
  );
  assert.strictEqual(
    grokVoiceIdOf({ id: 'grok:luna', name: 'Luna', lang: 'es-ES', index: -1 }),
    'luna',
  );
  assert.strictEqual(grokVoiceIdOf(null), null);

  section('mapGrokApiVoices / parseGrokVoicesResponse');
  const mapped = mapGrokApiVoices([
    { voice_id: 'eve', name: 'Eve' },
    { voice_id: 'ara', name: 'Ara' },
  ]);
  assert.strictEqual(mapped.length, 2);
  assert.strictEqual(mapped[0].id, `${GROK_VOICE_ID_PREFIX}eve`);
  assert.strictEqual(mapped[0].provider, 'grok');
  assert.strictEqual(mapped[0].grokVoiceId, 'eve');
  assert.strictEqual(mapped[0].lang, 'es-ES');
  assert.ok(mapped[0].name.includes('Grok') || mapped[0].name.includes('Eve'));
  assert.deepStrictEqual(mapGrokApiVoices([]), []);
  assert.deepStrictEqual(mapGrokApiVoices(null), []);
  assert.deepStrictEqual(
    parseGrokVoicesResponse({ available: false, voices: [{ voice_id: 'eve' }] }),
    [],
  );
  assert.strictEqual(
    parseGrokVoicesResponse({
      available: true,
      voices: [{ voice_id: 'orion', name: 'Orion' }],
    }).length,
    1,
  );

  section('mergeNarratorVoices — system first, then Grok');
  const system = [
    { id: 'sys1', name: 'Diego', lang: 'es-ES', index: 0, provider: 'system' },
  ];
  const grok = mapGrokApiVoices([{ voice_id: 'eve', name: 'Eve' }]);
  const merged = mergeNarratorVoices(system, grok);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].id, 'sys1');
  assert.strictEqual(merged[1].provider, 'grok');
  // Offline / no API: empty grok → only system
  assert.deepStrictEqual(mergeNarratorVoices(system, []), system);

  section('URLs and speak body');
  assert.strictEqual(
    grokVoicesUrl('http://localhost:3000/api/v1'),
    'http://localhost:3000/api/v1/tts/voices',
  );
  assert.strictEqual(
    grokSpeakUrl('http://localhost:3000/api/v1/'),
    'http://localhost:3000/api/v1/tts/speak',
  );
  const speakBody = buildGrokSpeakBody({
    text: '  CIC 27  ',
    voice: mapped[0],
    language: 'es-ES',
    rate: 1.25,
  });
  assert.strictEqual(speakBody.text, 'CIC 27');
  assert.strictEqual(speakBody.voice_id, 'eve');
  assert.strictEqual(speakBody.language, 'es-ES');
  assert.strictEqual(speakBody.speed, 1.25);

  section('rate applied once (API speed, not double with playbackRate)');
  const plan = planGrokRate(1.25);
  assert.strictEqual(plan.apiSpeed, 1.25);
  assert.strictEqual(plan.playbackRate, 1, 'local audio must not re-scale');
  assert.strictEqual(planGrokRate(undefined).playbackRate, 1);
  // Shipped speakGrok must not set audio.playbackRate from opts.rate
  // (would stack with body.speed → ~1.56× at rate 1.25).
  assert.ok(
    !/playbackRate\s*=\s*[^;]*opts\.rate/.test(svc),
    'narrator.service must not set playbackRate from opts.rate',
  );
  assert.ok(
    svc.includes('buildGrokSpeakBody'),
    'speakGrok uses buildGrokSpeakBody for API speed',
  );

  section('narrVoicePillLabel');
  assert.strictEqual(narrVoicePillLabel(null, []), 'Voz');
  assert.ok(narrVoicePillLabel(mapped[0], merged).startsWith('Grok'));
  assert.strictEqual(
    narrVoicePillLabel(system[0], system),
    'es-ES',
  );

  section('service routes Grok only when voice is Grok (structural)');
  // Path: speak() checks isGrokVoice before Web Speech / Capacitor
  assert.ok(svc.includes('if (isGrokVoice'), 'speak branches on isGrokVoice');
  assert.ok(svc.includes('cancel'), 'cancel exists');
  assert.ok(
    svc.includes('stopPlaybackEngines') || svc.includes('grokAudio'),
    'cancel stops Grok audio',
  );

  console.log('\nAll narrator-grok.logic tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
