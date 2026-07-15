/**
 * Tests del cliente xAI TTS y del armado de requests (módulo shipped).
 * Stubs solo de red externa (fetch); no reimplementa la lógica bajo test.
 *
 * Run: node --experimental-strip-types src/services/xaiTts.test.js
 * From backend/: npm run test:tts  (if wired) or monorepo yarn test:tts
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const SERVICE_TS = path.join(HERE, 'xaiTts.ts');
const ROUTES_TS = path.resolve(HERE, '../routes/tts.ts');
const CONFIG_TS = path.resolve(HERE, '../config.ts');
const INDEX_TS = path.resolve(HERE, '../index.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadService() {
  return import(pathToFileURL(SERVICE_TS).href + `?t=${Date.now()}`);
}

async function main() {
  section('shipped artifacts exist');
  assert.ok(fs.existsSync(SERVICE_TS), 'xaiTts.ts');
  assert.ok(fs.existsSync(ROUTES_TS), 'routes/tts.ts');
  assert.ok(fs.existsSync(CONFIG_TS), 'config.ts');
  const indexSrc = fs.readFileSync(INDEX_TS, 'utf8');
  assert.ok(indexSrc.includes('ttsRouter'), 'index mounts ttsRouter');
  assert.ok(indexSrc.includes("from './routes/tts'"), 'index imports tts routes');
  const configSrc = fs.readFileSync(CONFIG_TS, 'utf8');
  assert.ok(configSrc.includes('xaiApiKey'), 'config has xaiApiKey');
  assert.ok(configSrc.includes('XAI_API_KEY'), 'config reads XAI_API_KEY');
  assert.ok(
    configSrc.includes('SuperGrok') || configSrc.includes('console.x.ai'),
    'config documents SuperGrok vs API key',
  );
  const routeSrc = fs.readFileSync(ROUTES_TS, 'utf8');
  assert.ok(routeSrc.includes('/tts/voices'), 'GET voices path');
  assert.ok(routeSrc.includes('/tts/speak'), 'POST speak path');
  assert.ok(routeSrc.includes('503'), '503 when not configured');

  const {
    buildTtsRequestBody,
    validateTtsText,
    createXaiTtsClient,
    XAI_TTS_MAX_CHARS,
    XaiTtsError,
  } = await loadService();

  section('validateTtsText');
  assert.strictEqual(validateTtsText(''), 'text is required');
  assert.strictEqual(validateTtsText('   '), 'text is required');
  assert.strictEqual(validateTtsText('hola'), null);
  assert.ok(
    validateTtsText('x'.repeat(XAI_TTS_MAX_CHARS + 1))?.includes('exceeds'),
  );
  assert.strictEqual(validateTtsText('x'.repeat(XAI_TTS_MAX_CHARS)), null);

  section('buildTtsRequestBody (shipped)');
  const body = buildTtsRequestBody({
    text: '  En el principio  ',
    voiceId: 'ara',
    language: 'es-ES',
    speed: 1.25,
  });
  assert.strictEqual(body.text, 'En el principio');
  assert.strictEqual(body.voice_id, 'ara');
  assert.strictEqual(body.language, 'es-ES');
  assert.strictEqual(body.speed, 1.25);
  const clamped = buildTtsRequestBody({ text: 'a', speed: 9 });
  assert.strictEqual(clamped.speed, 1.5);
  const low = buildTtsRequestBody({ text: 'a', speed: 0.1 });
  assert.strictEqual(low.speed, 0.7);
  const def = buildTtsRequestBody({ text: 'hi' });
  assert.strictEqual(def.voice_id, 'eve');
  assert.strictEqual(def.language, 'es-ES');

  section('createXaiTtsClient.listVoices via fetch stub');
  const calls = [];
  const fakeVoices = {
    voices: [
      { voice_id: 'eve', name: 'Eve' },
      { voice_id: 'ara', name: 'Ara' },
    ],
  };
  const fetchList = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => fakeVoices,
      text: async () => '',
      headers: { get: () => 'application/json' },
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };
  const c1 = createXaiTtsClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.x.ai/v1',
    fetchImpl: fetchList,
  });
  const voices = await c1.listVoices();
  assert.strictEqual(voices.length, 2);
  assert.strictEqual(voices[0].voice_id, 'eve');
  assert.ok(String(calls[0].url).endsWith('/tts/voices'));
  assert.strictEqual(
    calls[0].init.headers.Authorization,
    'Bearer test-key',
  );

  section('createXaiTtsClient.synthesize via fetch stub');
  const audioBytes = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  const fetchSpeak = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'audio/mpeg' : null) },
      arrayBuffer: async () => audioBytes,
      text: async () => '',
      json: async () => ({}),
    };
  };
  const c2 = createXaiTtsClient({
    apiKey: 'k',
    baseUrl: 'https://api.x.ai/v1',
    fetchImpl: fetchSpeak,
  });
  const result = await c2.synthesize({
    text: 'Dios es amor.',
    voiceId: 'eve',
    language: 'es-MX',
    speed: 1,
  });
  assert.strictEqual(result.contentType, 'audio/mpeg');
  assert.strictEqual(result.body.byteLength, 5);
  const speakCall = calls[calls.length - 1];
  assert.ok(String(speakCall.url).endsWith('/tts'));
  assert.strictEqual(speakCall.init.method, 'POST');
  const parsed = JSON.parse(speakCall.init.body);
  assert.strictEqual(parsed.text, 'Dios es amor.');
  assert.strictEqual(parsed.voice_id, 'eve');
  assert.strictEqual(parsed.language, 'es-MX');

  section('synthesize rejects empty text without network');
  let threw = false;
  try {
    await c2.synthesize({ text: '' });
  } catch (e) {
    threw = true;
    assert.ok(e instanceof XaiTtsError);
    assert.strictEqual(e.status, 400);
  }
  assert.ok(threw, 'empty text throws');

  section('upstream error maps status');
  const fetchFail = async () => ({
    ok: false,
    status: 429,
    text: async () => 'rate limited',
    headers: { get: () => null },
  });
  const c3 = createXaiTtsClient({ apiKey: 'k', fetchImpl: fetchFail });
  try {
    await c3.listVoices();
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof XaiTtsError);
    assert.strictEqual(e.status, 429);
  }

  console.log('\nAll xaiTts tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
