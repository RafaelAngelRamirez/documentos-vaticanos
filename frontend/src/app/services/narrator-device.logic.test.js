/**
 * Un mismo catálogo y la misma frase para Web Speech y Capacitor TTS.
 * Run: node --experimental-strip-types src/app/services/narrator-device.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'narrator-device.logic.ts');
const SERVICE = path.join(HERE, 'narrator.service.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC));
  const service = fs.readFileSync(SERVICE, 'utf8');
  assert.ok(service.includes('mapDeviceEngineVoices'), 'both engines share the map');
  assert.ok(service.includes('deviceCatalogForPrefix'), 'offline catalog is shared');
  assert.ok(service.includes('engineVoiceIndex'), 'native speak resolves by id');
  assert.ok(service.includes('deviceVoiceId'), 'web speak resolves by the same id');
  assert.ok(service.includes('planUtterance'), 'other screens use the shared plan');
  assert.ok(
    !service.includes('voice: live.voice.index'),
    'native speak no longer trusts a stale index',
  );

  const device = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);

  section('same identity on both engines');
  const webRaw = [
    {
      voiceURI: 'es-MX-local',
      name: 'Sabina',
      lang: 'es_MX',
      localService: true,
      index: 4,
    },
    {
      voiceURI: 'es-ES-local',
      name: 'Paulina',
      lang: 'es-ES',
      localService: true,
      index: 1,
    },
    {
      voiceURI: 'es-ES-cloud',
      name: 'Google',
      lang: 'es-ES',
      localService: false,
      index: 0,
    },
  ];
  const apkRaw = [
    {
      voiceURI: 'es-ES-cloud',
      name: 'Google',
      lang: 'es-ES',
      localService: false,
      index: 2,
    },
    {
      voiceURI: 'es-ES-local',
      name: 'Paulina',
      lang: 'ES-es',
      localService: true,
      index: 7,
    },
    {
      voiceURI: 'es-MX-local',
      name: 'Sabina',
      lang: 'es-MX',
      localService: true,
      index: 3,
    },
  ];
  const web = device.mapDeviceEngineVoices(webRaw);
  const apk = device.mapDeviceEngineVoices(apkRaw);
  assert.deepStrictEqual(
    web.map((voice) => voice.id),
    ['es-ES-local', 'es-MX-local', 'es-ES-cloud'],
    'locals stay in engine order, then remote voices',
  );
  assert.deepStrictEqual(
    apk.map((voice) => voice.id),
    ['es-MX-local', 'es-ES-local', 'es-ES-cloud'],
    'each engine keeps its own order after the local cut',
  );
  assert.deepStrictEqual(
    web.map((voice) => voice.lang),
    ['es-ES', 'es-MX', 'es-ES'],
  );
  assert.strictEqual(device.canonicalSpeechLang('ES_mx'), 'es-MX');
  assert.strictEqual(apk.find((voice) => voice.id === 'es-ES-local').index, 7);
  assert.strictEqual(device.engineVoiceIndex(apk, 'es-MX-local'), 3);
  assert.strictEqual(device.engineVoiceIndex(web, 'es-ES-local'), 1);
  assert.strictEqual(device.engineVoiceIndex(web, 'missing'), null);

  const offline = device.deviceCatalogForPrefix(web, 'es');
  assert.deepStrictEqual(
    offline.map((voice) => voice.id),
    ['es-ES-local', 'es-MX-local'],
    'a local voice drops the remote one',
  );
  const remoteOnly = device.deviceCatalogForPrefix(
    device.mapDeviceEngineVoices([
      {
        voiceURI: 'google-es',
        name: 'Google',
        lang: 'es-ES',
        localService: false,
        index: 2,
      },
    ]),
    'es',
  );
  assert.strictEqual(remoteOnly[0].id, 'google-es', 'remote stays if nothing local exists');

  const unnamed = device.mapDeviceEngineVoices([
    { name: 'Helena', lang: 'es_ES', localService: true, index: 5 },
  ]);
  assert.strictEqual(unnamed[0].id, 'name:Helena|es-ES');

  section('utterance plan');
  const catalog = [
    ...offline,
    {
      id: 'grok:eve',
      name: 'Eve',
      lang: 'es-ES',
      index: -1,
      provider: 'grok',
    },
    {
      id: 'en-US-local',
      name: 'Samantha',
      lang: 'en-US',
      index: 8,
      provider: 'system',
      local: true,
    },
  ];
  const grokEs = device.planNarratorUtterance({
    voices: catalog,
    voiceId: 'grok:eve',
    voiceByLang: { es: 'es-MX-local', en: 'en-US-local' },
    lang: 'es_ES',
    rate: 1.25,
  });
  assert.strictEqual(grokEs.lang, 'es-ES');
  assert.strictEqual(grokEs.rate, 1.25);
  assert.strictEqual(grokEs.voice.id, 'grok:eve');

  const deviceEn = device.planNarratorUtterance({
    voices: catalog,
    voiceId: 'grok:eve',
    voiceByLang: { es: 'es-MX-local', en: 'en-US-local' },
    lang: 'en-US',
    rate: 1,
  });
  assert.strictEqual(deviceEn.voice.id, 'en-US-local', 'Grok es does not speak English');

  const deviceEs = device.planNarratorUtterance({
    voices: offline,
    voiceId: 'grok:eve',
    voiceByLang: { es: 'es-MX-local' },
    lang: 'es-ES',
    rate: 3,
  });
  assert.strictEqual(deviceEs.voice.id, 'es-MX-local', 'offline keeps the device voice');
  assert.strictEqual(deviceEs.rate, 1, 'a rate outside the steps falls back to 1');
  assert.strictEqual(
    device.pickSavedDeviceVoice(offline, { voiceId: 'grok:eve', voiceByLang: {} }, 'es'),
    null,
    'Grok alone does not invent a device voice',
  );

  section('listed cycle');
  const listed = [...offline, catalog.find((voice) => voice.id === 'grok:eve')];
  assert.strictEqual(device.cycleListedVoice(listed, 'es-MX-local').id, 'grok:eve');
  assert.strictEqual(device.cycleListedVoice(listed, 'grok:eve').id, 'es-ES-local');
  assert.strictEqual(device.cycleListedVoice([offline[0]], null).id, 'es-ES-local');
  assert.strictEqual(device.cycleListedVoice([], 'es-ES-local'), null);

  console.log('\nnarrator device logic ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
